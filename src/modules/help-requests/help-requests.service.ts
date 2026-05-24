import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ComplaintStatus,
  HelpRequestStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { paginate } from '../../core/common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import {
  AssignHelpRequestDto,
  CloseHelpRequestDto,
  CreateHelpRequestDto,
  HelpRequestQueryDto,
  RespondHelpRequestDto,
  SubmitHelpRequestDto,
} from './dto/help-request.dto';

/**
 * Statuses where a complaint is considered actively being worked on and a
 * help request is operationally meaningful. Outside of these, asking for
 * help is premature (complaint not even routed/assigned yet) or pointless
 * (work is already closed). Keep in sync with TransfersService.
 */
const HELP_REQUESTABLE_STATUSES: ComplaintStatus[] = [
  ComplaintStatus.ASSIGNED,
  ComplaintStatus.IN_PROGRESS,
  ComplaintStatus.PENDING_APPROVAL,
];

/**
 * Cross-department HELP requests.
 *
 * Difference from {@link TransfersService}:
 *   - Transfers MOVE ownership of a complaint/task to another department.
 *   - Help requests BORROW capacity: the complaint stays put, the helper
 *     department contributes work, and the original department keeps
 *     accountability and final closure.
 *
 * Lifecycle (see HelpRequestStatus enum for full doc):
 *   PENDING → ACCEPTED → IN_PROGRESS → SUBMITTED → COMPLETED
 *           ↘ DECLINED                          ↘ REJECTED
 *           ↘ CANCELLED (requester withdrew)
 */
@Injectable()
export class HelpRequestsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsResolver,
    private audit: AuditService,
    private notifications: NotificationsService,
    private realtime: RealtimeService,
  ) {}

  // ============================================================
  // CREATE — anyone with help.request perm who has skin in the game
  // ============================================================

  async create(
    user: { id: string; email: string; municipalityId: string },
    complaintId: string,
    dto: CreateHelpRequestDto,
    req?: Request,
  ) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id: complaintId, municipalityId: user.municipalityId, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        municipalityId: true,
        departmentId: true,
        createdById: true,
        assignments: {
          where: { isActive: true },
          select: { assignedToId: true },
        },
      },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');
    if (!complaint.departmentId) {
      throw new BadRequestException(
        'This complaint has no owning department yet. It needs to be routed first.',
      );
    }
    if (complaint.departmentId === dto.toDepartmentId) {
      throw new BadRequestException(
        'You cannot request help from your own department. Use direct assignment.',
      );
    }

    // Minimum complaint status gate. Asking for help on a SUBMITTED or
    // UNDER_REVIEW complaint is premature — the source dept hasn't decided
    // they need help yet. After COMPLETED/CLOSED/REJECTED it's pointless.
    if (!HELP_REQUESTABLE_STATUSES.includes(complaint.status)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'COMPLAINT_NOT_HELP_REQUESTABLE',
        message: `Cannot request help while complaint is ${complaint.status}. Assign a worker first; help requests open once work is in progress.`,
      });
    }

    // The helper dept must exist in the same municipality
    const toDept = await this.prisma.department.findFirst({
      where: {
        id: dto.toDepartmentId,
        municipalityId: user.municipalityId,
        deletedAt: null,
      },
    });
    if (!toDept) throw new NotFoundException('Helper department not found');

    // Caller must be involved with the complaint: same dept member,
    // current assignee, or have privileged "view all" perms.
    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    const perms = await this.permissions.getUserPermissions(user.id);
    const isPrivileged = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    const sameDept = me?.departmentId === complaint.departmentId;
    const isAssignee = complaint.assignments.some(
      (a) => a.assignedToId === user.id,
    );
    if (!isPrivileged && !sameDept && !isAssignee) {
      throw new ForbiddenException(
        'You can only request help for complaints in your department or assigned to you.',
      );
    }

    // Source-side approval gate. Pure workers (only complaint.view_assigned,
    // no dept-level visibility) cannot send help requests directly to a
    // receiver HOD — they must escalate through a Supervisor or HOD who has
    // dept-level oversight. This prevents a single worker from triggering
    // cross-department political friction without source-side sign-off.
    // Workers can still flag the need via in-team channels; the supervisor
    // then opens the formal help request on their behalf.
    const hasDeptOversight =
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    if (!hasDeptOversight) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'SOURCE_APPROVAL_REQUIRED',
        message:
          'Workers must escalate help requests through their Supervisor or Head of Department. Ask them to open the request on your behalf.',
      });
    }

    // No more than one OPEN help request at a time per complaint
    const open = await this.prisma.complaintHelpRequest.findFirst({
      where: {
        complaintId,
        status: {
          in: [
            HelpRequestStatus.PENDING,
            HelpRequestStatus.ACCEPTED,
            HelpRequestStatus.IN_PROGRESS,
            HelpRequestStatus.SUBMITTED,
          ],
        },
      },
      select: { id: true },
    });
    if (open) {
      throw new BadRequestException(
        'There is already an active help request for this complaint.',
      );
    }

    const created = await this.prisma.complaintHelpRequest.create({
      data: {
        municipalityId: user.municipalityId,
        complaintId,
        fromDepartmentId: complaint.departmentId,
        toDepartmentId: dto.toDepartmentId,
        requestedById: user.id,
        reason: dto.reason,
      },
      include: this.includeRelations(),
    });

    // Notify helper-dept HOD + tenant admins
    const recipientIds = await this.recipientsForToDept(
      user.municipalityId,
      dto.toDepartmentId,
    );
    if (recipientIds.length) {
      await this.notifications
        .createAndSend(
          user.municipalityId,
          recipientIds,
          NotificationType.HELP_REQUESTED,
          'Help request received',
          `${created.fromDepartment.name} → ${created.toDepartment.name}: "${complaint.title}"`,
          {
            helpRequestId: created.id,
            complaintId,
          },
        )
        .catch(() => undefined);
    }

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: 'help.request',
      resourceType: 'complaint',
      resourceId: complaintId,
      metadata: {
        helpRequestId: created.id,
        from: complaint.departmentId,
        to: dto.toDepartmentId,
        reason: dto.reason,
      },
    });

    this.realtime.helpRequestEvent('help-request:created', {
      id: created.id,
      complaintId,
      municipalityId: user.municipalityId,
      fromDepartmentId: created.fromDepartmentId,
      toDepartmentId: created.toDepartmentId,
      userIds: [user.id, ...recipientIds],
    });

    return created;
  }

  // ============================================================
  // ACCEPT (helper HOD says "we'll take it on")
  // ============================================================

  async accept(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: RespondHelpRequestDto,
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    if (hr.status !== HelpRequestStatus.PENDING) {
      throw new BadRequestException(
        `Help request is already ${hr.status.toLowerCase()}`,
      );
    }
    await this.assertCanRespond(user.id, hr.toDepartmentId);

    const updated = await this.prisma.complaintHelpRequest.update({
      where: { id },
      data: {
        status: HelpRequestStatus.ACCEPTED,
        respondedById: user.id,
        respondedAt: new Date(),
        responseReason: dto.note ?? null,
      },
      include: this.includeRelations(),
    });

    await this.notify(updated, NotificationType.HELP_ACCEPTED,
      'Help request accepted',
      `${updated.toDepartment.name} accepted your help request for "${updated.complaint.title}".`,
      [updated.requestedById],
    );
    await this.auditChange(req, user, updated, 'help.accept', { note: dto.note });
    this.emitUpdated(updated);
    return updated;
  }

  // ============================================================
  // DECLINE (helper HOD refuses)
  // ============================================================

  async decline(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: RespondHelpRequestDto,
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    if (hr.status !== HelpRequestStatus.PENDING) {
      throw new BadRequestException(
        `Help request is already ${hr.status.toLowerCase()}`,
      );
    }
    if (!dto.note || dto.note.trim().length < 5) {
      throw new BadRequestException(
        'A short reason (5+ chars) is required when declining a help request.',
      );
    }
    await this.assertCanRespond(user.id, hr.toDepartmentId);

    const updated = await this.prisma.complaintHelpRequest.update({
      where: { id },
      data: {
        status: HelpRequestStatus.DECLINED,
        respondedById: user.id,
        respondedAt: new Date(),
        responseReason: dto.note,
      },
      include: this.includeRelations(),
    });

    await this.notify(updated, NotificationType.HELP_DECLINED,
      'Help request declined',
      `${updated.toDepartment.name} declined: ${dto.note}`,
      [updated.requestedById],
    );
    await this.auditChange(req, user, updated, 'help.decline', { note: dto.note });
    this.emitUpdated(updated);
    return updated;
  }

  // ============================================================
  // ASSIGN helper worker (helper HOD picks someone)
  // ============================================================

  async assign(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: AssignHelpRequestDto,
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    if (
      hr.status !== HelpRequestStatus.ACCEPTED &&
      hr.status !== HelpRequestStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Cannot assign helper while status is ${hr.status.toLowerCase()}`,
      );
    }
    await this.assertCanRespond(user.id, hr.toDepartmentId);

    const assignee = await this.prisma.user.findFirst({
      where: {
        id: dto.helperAssigneeId,
        municipalityId: user.municipalityId,
        departmentId: hr.toDepartmentId,
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!assignee) {
      throw new BadRequestException(
        'The chosen helper must be an active member of the helper department.',
      );
    }

    const updated = await this.prisma.complaintHelpRequest.update({
      where: { id },
      data: {
        status: HelpRequestStatus.IN_PROGRESS,
        helperAssigneeId: dto.helperAssigneeId,
      },
      include: this.includeRelations(),
    });

    await this.notify(updated, NotificationType.HELP_ASSIGNED,
      'You have been assigned to help on a complaint',
      `${updated.fromDepartment.name} requested help: "${updated.complaint.title}". Reason: ${updated.reason}`,
      [dto.helperAssigneeId, updated.requestedById],
    );
    await this.auditChange(req, user, updated, 'help.assign', {
      helperAssigneeId: dto.helperAssigneeId,
      note: dto.note,
    });
    this.emitUpdated(updated, [dto.helperAssigneeId]);
    return updated;
  }

  // ============================================================
  // SUBMIT (helper worker / HOD uploads proof of work)
  // ============================================================

  async submit(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: SubmitHelpRequestDto,
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    if (
      hr.status !== HelpRequestStatus.IN_PROGRESS &&
      hr.status !== HelpRequestStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        `Cannot submit while status is ${hr.status.toLowerCase()}`,
      );
    }

    // Only the assigned helper or the helper-dept HOD/Admin can submit.
    // We deliberately drop the previous "any same-dept member" loophole —
    // that allowed every worker in the helper department to upload work
    // for a request that wasn't theirs.
    const perms = await this.permissions.getUserPermissions(user.id);
    const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    const isAssigned = hr.helperAssigneeId === user.id;
    const isHelperHod = await this.isHodOf(user.id, hr.toDepartmentId);
    if (!isAdmin && !isAssigned && !isHelperHod) {
      throw new ForbiddenException(
        'Only the assigned helper or their HOD can submit work.',
      );
    }

    const updated = await this.prisma.complaintHelpRequest.update({
      where: { id },
      data: {
        status: HelpRequestStatus.SUBMITTED,
        submittedById: user.id,
        submittedAt: new Date(),
        solutionNotes: dto.notes,
        solutionAttachments: (dto.attachments ?? []) as unknown as Prisma.InputJsonValue,
      },
      include: this.includeRelations(),
    });

    await this.notify(updated, NotificationType.HELP_SUBMITTED,
      'Helper department submitted work',
      `${updated.toDepartment.name} finished helping with "${updated.complaint.title}". Please review.`,
      this.recipientsForCloseReview(updated),
    );
    await this.auditChange(req, user, updated, 'help.submit', {
      hasAttachments: (dto.attachments ?? []).length,
    });
    this.emitUpdated(updated);
    return updated;
  }

  // ============================================================
  // APPROVE (original HOD accepts helper contribution → COMPLETED)
  // ============================================================

  async approve(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: CloseHelpRequestDto,
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    if (hr.status !== HelpRequestStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve while status is ${hr.status.toLowerCase()}. Helper must submit first.`,
      );
    }
    await this.assertCanCloseFromOriginal(user.id, hr.fromDepartmentId);

    const updated = await this.prisma.complaintHelpRequest.update({
      where: { id },
      data: {
        status: HelpRequestStatus.COMPLETED,
        closedById: user.id,
        closedAt: new Date(),
        closeReason: dto.reason ?? null,
      },
      include: this.includeRelations(),
    });

    await this.notify(updated, NotificationType.HELP_COMPLETED,
      'Help request completed',
      `Your contribution to "${updated.complaint.title}" was approved by ${updated.fromDepartment.name}.`,
      this.contributorsOf(updated),
    );
    await this.auditChange(req, user, updated, 'help.approve', { reason: dto.reason });
    this.emitUpdated(updated);
    return updated;
  }

  // ============================================================
  // REJECT helper submission (original HOD says "this isn't enough")
  // ============================================================

  async reject(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: CloseHelpRequestDto,
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    if (hr.status !== HelpRequestStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject while status is ${hr.status.toLowerCase()}.`,
      );
    }
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException(
        'A short reason (5+ chars) is required to reject helper work.',
      );
    }
    await this.assertCanCloseFromOriginal(user.id, hr.fromDepartmentId);

    const updated = await this.prisma.complaintHelpRequest.update({
      where: { id },
      data: {
        status: HelpRequestStatus.REJECTED,
        closedById: user.id,
        closedAt: new Date(),
        closeReason: dto.reason,
      },
      include: this.includeRelations(),
    });

    await this.notify(updated, NotificationType.HELP_REJECTED,
      'Helper work rejected',
      `${updated.fromDepartment.name} rejected the helper work for "${updated.complaint.title}": ${dto.reason}`,
      this.contributorsOf(updated),
    );
    await this.auditChange(req, user, updated, 'help.reject', { reason: dto.reason });
    this.emitUpdated(updated);
    return updated;
  }

  // ============================================================
  // CANCEL (requester withdraws while still pending/accepted)
  // ============================================================

  async cancel(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    const cancellableFrom: HelpRequestStatus[] = [
      HelpRequestStatus.PENDING,
      HelpRequestStatus.ACCEPTED,
      HelpRequestStatus.IN_PROGRESS,
    ];
    if (!cancellableFrom.includes(hr.status)) {
      throw new BadRequestException(
        `Cannot cancel while status is ${hr.status.toLowerCase()}.`,
      );
    }

    // Requester or HOD of original department or Admin can cancel
    const perms = await this.permissions.getUserPermissions(user.id);
    const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    const isOriginalHod = await this.isHodOf(user.id, hr.fromDepartmentId);
    if (
      !isAdmin &&
      !isOriginalHod &&
      hr.requestedById !== user.id
    ) {
      throw new ForbiddenException(
        'Only the requester, their HOD, or an Admin can cancel a help request.',
      );
    }

    const updated = await this.prisma.complaintHelpRequest.update({
      where: { id },
      data: {
        status: HelpRequestStatus.CANCELLED,
        closedById: user.id,
        closedAt: new Date(),
      },
      include: this.includeRelations(),
    });

    await this.notify(updated, NotificationType.HELP_CANCELLED,
      'Help request cancelled',
      `${updated.fromDepartment.name} withdrew their help request for "${updated.complaint.title}".`,
      this.contributorsOf(updated),
    );
    await this.auditChange(req, user, updated, 'help.cancel', {});
    this.emitUpdated(updated);
    return updated;
  }

  // ============================================================
  // QUERY
  // ============================================================

  async findAll(userId: string, municipalityId: string, query: HelpRequestQueryDto) {
    const where: any = { municipalityId };
    const filters: any[] = [];

    if (query.status) filters.push({ status: query.status });
    if (query.complaintId) filters.push({ complaintId: query.complaintId });

    if (query.inbox || query.outgoing) {
      const me = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      const perms = await this.permissions.getUserPermissions(userId);
      const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
      const hasDeptOversight =
        perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
        perms.includes(PERMISSIONS.HELP_RESPOND);

      if (query.inbox) {
        // Inbox = "requests landing in MY dept that need HOD/Supervisor
        // attention". Pure workers (no dept-level oversight, no help.respond)
        // never see receiver inbox; only their own assigned helper work,
        // which they reach via complaint detail or "outgoing"-of-self.
        if (isAdmin) {
          // admin sees nothing extra; the muni filter is enough
        } else if (hasDeptOversight && me?.departmentId) {
          filters.push({ toDepartmentId: me.departmentId });
        } else if (me?.departmentId) {
          // Worker: only requests where they are the helper assignee.
          filters.push({
            toDepartmentId: me.departmentId,
            helperAssigneeId: userId,
          });
        } else {
          return paginate([], 0, query);
        }
      }
      if (query.outgoing) {
        if (isAdmin) {
          // skip narrow filter
        } else if (hasDeptOversight && me?.departmentId) {
          filters.push({
            OR: [
              { fromDepartmentId: me.departmentId },
              { requestedById: userId },
            ],
          });
        } else {
          // Pure worker can only see requests they personally raised.
          filters.push({ requestedById: userId });
        }
      }
    }

    if (filters.length) where.AND = filters;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const [items, total] = await Promise.all([
      this.prisma.complaintHelpRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: this.includeRelations(),
      }),
      this.prisma.complaintHelpRequest.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string, userId: string, municipalityId: string) {
    const hr = await this.loadOrFail(id, municipalityId);
    await this.assertCanRead(userId, hr);
    return hr;
  }

  /** Pending help-requests targeting the caller's department (badge count). */
  async pendingCount(userId: string, municipalityId: string): Promise<number> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const perms = await this.permissions.getUserPermissions(userId);
    const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    const hasDeptOversight =
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      perms.includes(PERMISSIONS.HELP_RESPOND);

    if (isAdmin) {
      return this.prisma.complaintHelpRequest.count({
        where: { municipalityId, status: HelpRequestStatus.PENDING },
      });
    }
    // Workers don't see receiver inbox badge — they have no action to take.
    if (!hasDeptOversight || !me?.departmentId) return 0;
    return this.prisma.complaintHelpRequest.count({
      where: {
        municipalityId,
        toDepartmentId: me.departmentId,
        status: HelpRequestStatus.PENDING,
      },
    });
  }

  /**
   * Help-request history for a single complaint (for the timeline strip).
   *
   * Scoped to the caller's authority:
   *   - Admin: sees everything for the complaint
   *   - Source-side staff (dept oversight / same dept / assigned worker on
   *     the complaint): sees everything for the complaint
   *   - Helper-side dept oversight (HOD/Supervisor of the helper dept):
   *     sees requests targeting their department
   *   - Helper-side assigned worker: sees only the specific request(s) they
   *     were assigned to
   *   - Other users: empty
   */
  async historyFor(complaintId: string, userId: string, municipalityId: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id: complaintId, municipalityId, deletedAt: null },
      select: {
        id: true,
        departmentId: true,
        createdById: true,
        assignments: {
          where: { isActive: true },
          select: { assignedToId: true },
        },
      },
    });
    if (!complaint) return [];

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const perms = await this.permissions.getUserPermissions(userId);
    const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);

    if (isAdmin) {
      return this.prisma.complaintHelpRequest.findMany({
        where: { complaintId, municipalityId },
        orderBy: { createdAt: 'asc' },
        include: this.includeRelations(),
      });
    }

    const sourceDeptOversight =
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) &&
      me?.departmentId === complaint.departmentId;
    const isComplaintAssignee = complaint.assignments.some(
      (a) => a.assignedToId === userId,
    );
    const isCitizenOwner = complaint.createdById === userId;

    // Citizens never see help-request internals on their own complaint.
    if (isCitizenOwner && !sourceDeptOversight && !isComplaintAssignee) {
      return [];
    }

    // Source-side privileged: full timeline
    if (sourceDeptOversight || isComplaintAssignee) {
      return this.prisma.complaintHelpRequest.findMany({
        where: { complaintId, municipalityId },
        orderBy: { createdAt: 'asc' },
        include: this.includeRelations(),
      });
    }

    // Helper-side: only requests where helper dept = caller dept AND caller
    // has dept oversight OR was assigned the helper work.
    if (!me?.departmentId) return [];
    return this.prisma.complaintHelpRequest.findMany({
      where: {
        complaintId,
        municipalityId,
        toDepartmentId: me.departmentId,
        ...(perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
        perms.includes(PERMISSIONS.HELP_RESPOND)
          ? {}
          : { helperAssigneeId: userId }),
      },
      orderBy: { createdAt: 'asc' },
      include: this.includeRelations(),
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async loadOrFail(id: string, municipalityId: string) {
    const hr = await this.prisma.complaintHelpRequest.findFirst({
      where: { id, municipalityId },
      include: this.includeRelations(),
    });
    if (!hr) throw new NotFoundException('Help request not found');
    return hr;
  }

  /**
   * Authorize read access to a single help request. Mirrors the visibility
   * rules in `findAll`: source side sees full timeline, helper side only
   * sees what they were assigned or what they oversee, citizens see nothing.
   */
  private async assertCanRead(
    userId: string,
    hr: Awaited<ReturnType<typeof this.loadOrFail>>,
  ) {
    const perms = await this.permissions.getUserPermissions(userId);
    if (perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) return;

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const hasDeptOversight =
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      perms.includes(PERMISSIONS.HELP_RESPOND);

    // Source side
    if (hr.requestedById === userId) return;
    if (me?.departmentId && me.departmentId === hr.fromDepartmentId && hasDeptOversight) return;

    // Helper side
    if (hr.helperAssigneeId === userId) return;
    if (me?.departmentId && me.departmentId === hr.toDepartmentId && hasDeptOversight) return;

    throw new ForbiddenException('You do not have access to this help request');
  }

  private async assertCanRespond(userId: string, departmentId: string) {
    const perms = await this.permissions.getUserPermissions(userId);
    if (!perms.includes(PERMISSIONS.HELP_RESPOND)) {
      throw new ForbiddenException('You do not have permission to respond to help requests');
    }
    const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    if (isAdmin) return;
    if (!(await this.isHodOf(userId, departmentId))) {
      throw new ForbiddenException(
        'Only the Head of the helper department (or Admin) can respond to this request',
      );
    }
  }

  /**
   * Closing reviews come from the ORIGINAL (requesting) department's HOD or
   * Admin. The original HOD has accountability so they decide if the helper
   * contribution was sufficient.
   */
  private async assertCanCloseFromOriginal(userId: string, fromDepartmentId: string) {
    const perms = await this.permissions.getUserPermissions(userId);
    const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    if (isAdmin) return;
    if (!(await this.isHodOf(userId, fromDepartmentId))) {
      throw new ForbiddenException(
        'Only the Head of the requesting department (or Admin) can approve/reject helper work.',
      );
    }
  }

  private async isHodOf(userId: string, departmentId: string): Promise<boolean> {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { headUserId: true },
    });
    return dept?.headUserId === userId;
  }

  /**
   * Notification recipients for a NEW help request landing in `toDepartmentId`.
   *
   * Default: the receiver HOD. Admins are intentionally NOT notified for
   * routine help requests — they have full visibility via the dashboard and
   * shouldn't be paged for every operational request. Admins ARE notified as
   * a FALLBACK when the receiver dept has no HOD slot set, so the request
   * never goes unnoticed.
   */
  private async recipientsForToDept(
    municipalityId: string,
    toDepartmentId: string,
  ): Promise<string[]> {
    const dept = await this.prisma.department.findUnique({
      where: { id: toDepartmentId },
      select: { headUserId: true },
    });

    if (dept?.headUserId) {
      return [dept.headUserId];
    }

    // Fallback: HOD slot vacant — page admins so the request doesn't drop.
    const admins = await this.prisma.user.findMany({
      where: {
        municipalityId,
        isActive: true,
        userRoles: { some: { role: { name: 'Admin' } } },
      },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  /** People to ping when a helper submits their work. */
  private recipientsForCloseReview(hr: { fromDepartment: { headUserId?: string | null } | any; requestedById: string }) {
    const ids = new Set<string>([hr.requestedById]);
    if (hr.fromDepartment?.headUserId) ids.add(hr.fromDepartment.headUserId);
    return Array.from(ids);
  }

  /** Everyone who contributed on the helper side (assignee + HOD + responder). */
  private contributorsOf(hr: any): string[] {
    const ids = new Set<string>();
    if (hr.helperAssigneeId) ids.add(hr.helperAssigneeId);
    if (hr.respondedById) ids.add(hr.respondedById);
    if (hr.toDepartment?.headUserId) ids.add(hr.toDepartment.headUserId);
    return Array.from(ids);
  }

  private async notify(
    hr: any,
    type: NotificationType,
    title: string,
    body: string,
    userIds: string[],
  ) {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    if (!ids.length) return;
    await this.notifications
      .createAndSend(hr.municipalityId, ids, type, title, body, {
        helpRequestId: hr.id,
        complaintId: hr.complaintId,
      })
      .catch(() => undefined);
  }

  private async auditChange(
    req: Request | undefined,
    user: { id: string; email: string; municipalityId: string },
    hr: any,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action,
      resourceType: 'complaint',
      resourceId: hr.complaintId,
      metadata: { helpRequestId: hr.id, ...metadata },
    });
  }

  private emitUpdated(hr: any, extraUserIds: string[] = []) {
    this.realtime.helpRequestEvent('help-request:updated', {
      id: hr.id,
      complaintId: hr.complaintId,
      municipalityId: hr.municipalityId,
      fromDepartmentId: hr.fromDepartmentId,
      toDepartmentId: hr.toDepartmentId,
      userIds: [
        hr.requestedById,
        ...(hr.helperAssigneeId ? [hr.helperAssigneeId] : []),
        ...(hr.respondedById ? [hr.respondedById] : []),
        ...(hr.fromDepartment?.headUserId ? [hr.fromDepartment.headUserId] : []),
        ...(hr.toDepartment?.headUserId ? [hr.toDepartment.headUserId] : []),
        ...extraUserIds,
      ],
    });
  }

  private includeRelations() {
    return {
      complaint: { select: { id: true, title: true, referenceCode: true } },
      fromDepartment: { select: { id: true, name: true, headUserId: true } },
      toDepartment: { select: { id: true, name: true, headUserId: true } },
      requestedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      respondedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      helperAssignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      submittedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      closedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    } as const;
  }
}
