import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertEligibleStaffAssignee } from '../../core/users/user-governance';
import type { Request } from 'express';
import {
  AttachmentStage,
  ComplaintStatus,
  HelpRequestStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';

/**
 * Help workflow event kinds written into ComplaintStatusLog.eventKind so
 * the frontend can render them as event rows instead of fake same-status
 * transitions.
 */
const HELP_EVENT_KIND = {
  REQUESTED: 'HELP_REQUESTED',
  SOURCE_APPROVED: 'HELP_SOURCE_APPROVED',
  SOURCE_REJECTED: 'HELP_SOURCE_REJECTED',
  ACCEPTED: 'HELP_ACCEPTED',
  DECLINED: 'HELP_DECLINED',
  ASSIGNED: 'HELP_ASSIGNED',
  SUBMITTED: 'HELP_SUBMITTED',
  APPROVED: 'HELP_APPROVED',
  REJECTED: 'HELP_REJECTED',
  CANCELLED: 'HELP_CANCELLED',
} as const;

function isPrismaRecordNotFound(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'
  );
}

function helpStaleStateConflict(): never {
  throw new ConflictException({
    statusCode: 409,
    code: 'HELP_REQUEST_STATE_CONFLICT',
    message:
      'This help request has already been updated. Refresh and try again.',
  });
}
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { paginate } from '../../core/common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { AssignmentsService } from '../complaints/assignments.service';
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

/** Non-terminal help requests — at most one per complaint. */
const OPEN_HELP_STATUSES: HelpRequestStatus[] = [
  HelpRequestStatus.PENDING_SOURCE_APPROVAL,
  HelpRequestStatus.PENDING,
  HelpRequestStatus.ACCEPTED,
  HelpRequestStatus.IN_PROGRESS,
  HelpRequestStatus.SUBMITTED,
];

/** Terminal help-request statuses (history tab). */
const TERMINAL_HELP_STATUSES: HelpRequestStatus[] = [
  HelpRequestStatus.SOURCE_REJECTED,
  HelpRequestStatus.COMPLETED,
  HelpRequestStatus.DECLINED,
  HelpRequestStatus.REJECTED,
  HelpRequestStatus.CANCELLED,
];

const HELP_EVENT_KIND_VALUES = Object.values(HELP_EVENT_KIND);

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
    private assignments: AssignmentsService,
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
    const isAssignee = await this.assignments.isAssignedTo(complaintId, user.id);
    if (!isPrivileged && !sameDept && !isAssignee) {
      throw new ForbiddenException(
        'You can only request help for complaints in your department or assigned to you.',
      );
    }

    const hasDeptOversight =
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);

    // Workers must be the active assignee; Supervisors/HOD/Admin may open on behalf of the team.
    if (!hasDeptOversight && !isAssignee) {
      throw new ForbiddenException(
        'Only the assigned field worker can request cross-department help on this complaint.',
      );
    }

    const open = await this.prisma.complaintHelpRequest.findFirst({
      where: { complaintId, status: { in: OPEN_HELP_STATUSES } },
      select: { id: true },
    });
    if (open) {
      throw new BadRequestException(
        'There is already an active help request for this complaint.',
      );
    }

    const requester = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true },
    });
    const requesterName = requester
      ? `${requester.firstName} ${requester.lastName}`
      : 'Staff';

    const initialStatus = hasDeptOversight
      ? HelpRequestStatus.PENDING
      : HelpRequestStatus.PENDING_SOURCE_APPROVAL;

    const created = await this.prisma.complaintHelpRequest.create({
      data: {
        municipalityId: user.municipalityId,
        complaintId,
        fromDepartmentId: complaint.departmentId,
        toDepartmentId: dto.toDepartmentId,
        requestedById: user.id,
        reason: dto.reason,
        status: initialStatus,
        ...(hasDeptOversight
          ? {
              sourceApprovedById: user.id,
              sourceApprovedAt: new Date(),
            }
          : {}),
      },
      include: this.includeRelations(),
    });

    if (hasDeptOversight) {
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
            { helpRequestId: created.id, complaintId },
          )
          .catch(() => undefined);
      }
      await this.logHelpEvent(
        complaintId,
        user.id,
        HELP_EVENT_KIND.REQUESTED,
        `Help request sent to ${toDept.name} by ${requesterName}.`,
      );
      this.realtime.helpRequestEvent('help-request:created', {
        id: created.id,
        complaintId,
        municipalityId: user.municipalityId,
        fromDepartmentId: created.fromDepartmentId,
        toDepartmentId: created.toDepartmentId,
        userIds: [user.id, ...recipientIds],
      });
    } else {
      const sourceRecipients = await this.recipientsForFromDept(
        user.municipalityId,
        complaint.departmentId,
      );
      if (sourceRecipients.length) {
        await this.notifications
          .createAndSend(
            user.municipalityId,
            sourceRecipients,
            NotificationType.HELP_REQUESTED,
            'Help request awaiting your approval',
            `${requesterName} requested help from ${toDept.name} for "${complaint.title}". Review before it is sent.`,
            { helpRequestId: created.id, complaintId },
          )
          .catch(() => undefined);
      }
      await this.logHelpEvent(
        complaintId,
        user.id,
        HELP_EVENT_KIND.REQUESTED,
        `Help requested by ${requesterName} — awaiting source department approval.`,
      );
      this.realtime.helpRequestEvent('help-request:created', {
        id: created.id,
        complaintId,
        municipalityId: user.municipalityId,
        fromDepartmentId: created.fromDepartmentId,
        toDepartmentId: created.toDepartmentId,
        userIds: [user.id, ...sourceRecipients],
      });
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
        status: initialStatus,
      },
    });

    return created;
  }

  // ============================================================
  // SOURCE APPROVE — Supervisor/HOD sends request to receiver dept
  // ============================================================

  async approveSource(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: RespondHelpRequestDto,
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    if (hr.status !== HelpRequestStatus.PENDING_SOURCE_APPROVAL) {
      throw new BadRequestException(
        `Help request is not awaiting source approval (status: ${hr.status}).`,
      );
    }
    await this.assertCanApproveSource(user.id, hr.fromDepartmentId);

    // Atomic: only the first concurrent click wins. Race losers get 409.
    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: { id, status: HelpRequestStatus.PENDING_SOURCE_APPROVAL },
        data: {
          status: HelpRequestStatus.PENDING,
          sourceApprovedById: user.id,
          sourceApprovedAt: new Date(),
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    const recipientIds = await this.recipientsForToDept(
      user.municipalityId,
      hr.toDepartmentId,
    );
    await this.notify(
      updated,
      NotificationType.HELP_REQUESTED,
      'Help request received',
      `${updated.fromDepartment.name} → ${updated.toDepartment.name}: "${updated.complaint.title}"`,
      recipientIds,
    );
    await this.notify(
      updated,
      NotificationType.HELP_ACCEPTED,
      'Your help request was approved',
      `Your supervisor sent the help request to ${updated.toDepartment.name}.`,
      [updated.requestedById],
    );

    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.SOURCE_APPROVED,
      `Help request approved by source department and sent to ${updated.toDepartment.name}.`,
    );
    await this.auditChange(req, user, updated, 'help.approve_source', {
      note: dto.note,
    });
    this.emitUpdated(updated, recipientIds);
    return updated;
  }

  // ============================================================
  // SOURCE REJECT — Supervisor/HOD declines before sending
  // ============================================================

  async rejectSource(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: RespondHelpRequestDto,
    req?: Request,
  ) {
    const hr = await this.loadOrFail(id, user.municipalityId);
    if (hr.status !== HelpRequestStatus.PENDING_SOURCE_APPROVAL) {
      throw new BadRequestException(
        `Help request is not awaiting source approval (status: ${hr.status}).`,
      );
    }
    if (!dto.note || dto.note.trim().length < 5) {
      throw new BadRequestException(
        'A short reason (5+ chars) is required when rejecting a help request.',
      );
    }
    await this.assertCanApproveSource(user.id, hr.fromDepartmentId);

    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: { id, status: HelpRequestStatus.PENDING_SOURCE_APPROVAL },
        data: {
          status: HelpRequestStatus.SOURCE_REJECTED,
          sourceRejectedById: user.id,
          sourceRejectedAt: new Date(),
          sourceRejectReason: dto.note,
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    await this.notify(
      updated,
      NotificationType.HELP_REJECTED,
      'Help request not approved',
      `Your help request was not approved: ${dto.note}`,
      [updated.requestedById],
      {
        helpRejectPhase: 'SOURCE',
        action: 'help_reject_source',
      },
    );
    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.SOURCE_REJECTED,
      `Help request rejected by source department: ${dto.note}`,
    );
    await this.auditChange(req, user, updated, 'help.reject_source', {
      note: dto.note,
    });
    this.emitUpdated(updated);
    return updated;
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

    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: { id, status: HelpRequestStatus.PENDING },
        data: {
          status: HelpRequestStatus.ACCEPTED,
          respondedById: user.id,
          respondedAt: new Date(),
          responseReason: dto.note ?? null,
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    await this.notify(updated, NotificationType.HELP_ACCEPTED,
      'Help request accepted',
      `${updated.toDepartment.name} accepted your help request for "${updated.complaint.title}".`,
      [updated.requestedById],
    );
    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.ACCEPTED,
      `Help request accepted by ${updated.toDepartment.name}.`,
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

    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: { id, status: HelpRequestStatus.PENDING },
        data: {
          status: HelpRequestStatus.DECLINED,
          respondedById: user.id,
          respondedAt: new Date(),
          responseReason: dto.note,
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    await this.notify(updated, NotificationType.HELP_DECLINED,
      'Help request declined',
      `${updated.toDepartment.name} declined: ${dto.note}`,
      [updated.requestedById],
    );
    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.DECLINED,
      `Help request declined by ${updated.toDepartment.name}: ${dto.note}`,
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdVia: true,
        isActive: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });
    if (!assignee) {
      throw new BadRequestException(
        'The chosen helper must be an active staff member of the helper department.',
      );
    }
    assertEligibleStaffAssignee({
      createdVia: assignee.createdVia,
      isActive: assignee.isActive,
      userRoles: assignee.userRoles,
    });

    // Atomic: only ACCEPTED or IN_PROGRESS may move to IN_PROGRESS via assign.
    // We allow assign-while-IN_PROGRESS (reassigning the helper) but require
    // the previous status row to match one of those two.
    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: {
          id,
          status: {
            in: [HelpRequestStatus.ACCEPTED, HelpRequestStatus.IN_PROGRESS],
          },
        },
        data: {
          status: HelpRequestStatus.IN_PROGRESS,
          helperAssigneeId: dto.helperAssigneeId,
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    await this.notify(updated, NotificationType.HELP_ASSIGNED,
      'You have been assigned to help on a complaint',
      `${updated.fromDepartment.name} requested help: "${updated.complaint.title}". Reason: ${updated.reason}`,
      [dto.helperAssigneeId],
    );
    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.ASSIGNED,
      `Help assigned to ${assignee.firstName} ${assignee.lastName} in ${updated.toDepartment.name}.`,
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

    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: {
          id,
          status: {
            in: [HelpRequestStatus.IN_PROGRESS, HelpRequestStatus.ACCEPTED],
          },
        },
        data: {
          status: HelpRequestStatus.SUBMITTED,
          submittedById: user.id,
          submittedAt: new Date(),
          solutionNotes: dto.notes,
          solutionAttachments: (dto.attachments ?? []) as unknown as Prisma.InputJsonValue,
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    await this.notify(updated, NotificationType.HELP_SUBMITTED,
      'Helper department submitted work',
      `${updated.toDepartment.name} finished helping with "${updated.complaint.title}". Please review.`,
      this.recipientsForCloseReview(updated),
    );
    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.SUBMITTED,
      `Help work submitted by ${updated.toDepartment.name}.`,
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

    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: { id, status: HelpRequestStatus.SUBMITTED },
        data: {
          status: HelpRequestStatus.COMPLETED,
          closedById: user.id,
          closedAt: new Date(),
          closeReason: dto.reason ?? null,
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    await this.notify(updated, NotificationType.HELP_COMPLETED,
      'Help request completed',
      `Your contribution to "${updated.complaint.title}" was approved by ${updated.fromDepartment.name}.`,
      this.contributorsOf(updated),
    );
    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.APPROVED,
      'Help result approved by source department.',
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

    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: { id, status: HelpRequestStatus.SUBMITTED },
        data: {
          status: HelpRequestStatus.REJECTED,
          closedById: user.id,
          closedAt: new Date(),
          closeReason: dto.reason,
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    await this.notify(updated, NotificationType.HELP_REJECTED,
      'Helper work rejected',
      `${updated.fromDepartment.name} rejected the helper work for "${updated.complaint.title}": ${dto.reason}`,
      this.contributorsOf(updated),
      {
        helpRejectPhase: 'HELPER_WORK',
        action: 'help_reject_helper_work',
      },
    );
    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.REJECTED,
      `Help result rejected by source department: ${dto.reason}`,
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
      HelpRequestStatus.PENDING_SOURCE_APPROVAL,
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

    let updated;
    try {
      updated = await this.prisma.complaintHelpRequest.update({
        where: { id, status: { in: cancellableFrom } },
        data: {
          status: HelpRequestStatus.CANCELLED,
          closedById: user.id,
          closedAt: new Date(),
        },
        include: this.includeRelations(),
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) helpStaleStateConflict();
      throw err;
    }

    await this.notify(updated, NotificationType.HELP_CANCELLED,
      'Help request cancelled',
      `${updated.fromDepartment.name} withdrew their help request for "${updated.complaint.title}".`,
      this.contributorsOf(updated),
    );
    await this.logHelpEvent(
      hr.complaintId,
      user.id,
      HELP_EVENT_KIND.CANCELLED,
      `Help request cancelled by ${updated.fromDepartment.name}.`,
    );
    await this.auditChange(req, user, updated, 'help.cancel', {});
    this.emitUpdated(updated);
    return updated;
  }

  // ============================================================
  // QUERY
  // ============================================================

  async findAll(userId: string, municipalityId: string, query: HelpRequestQueryDto) {
    const where: Prisma.ComplaintHelpRequestWhereInput = { municipalityId };
    const filters: Prisma.ComplaintHelpRequestWhereInput[] = [];

    if (query.status) filters.push({ status: query.status });
    if (query.complaintId) filters.push({ complaintId: query.complaintId });

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const perms = await this.permissions.getUserPermissions(userId);
    const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    const hasDeptOversight =
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      perms.includes(PERMISSIONS.HELP_RESPOND);
    const canRespond = perms.includes(PERMISSIONS.HELP_RESPOND);

    if (query.queue) {
      const queueFilter = this.buildQueueFilter(
        query.queue,
        userId,
        me?.departmentId ?? null,
        isAdmin,
        hasDeptOversight,
        canRespond,
      );
      if (queueFilter === null) return paginate([], 0, query);
      filters.push(queueFilter);
    } else if (query.inbox || query.outgoing) {
      // Legacy mobile / API clients
      if (query.sourceApproval) {
        if (!query.outgoing) {
          throw new BadRequestException(
            'sourceApproval filter requires outgoing=true',
          );
        }
        const q = this.buildQueueFilter(
          'sourceApproval',
          userId,
          me?.departmentId ?? null,
          isAdmin,
          hasDeptOversight,
          canRespond,
        );
        if (q) filters.push(q);
        else return paginate([], 0, query);
      }
      if (query.inbox) {
        if (canRespond && (isAdmin || me?.departmentId)) {
          const q = this.buildQueueFilter(
            'incoming',
            userId,
            me?.departmentId ?? null,
            isAdmin,
            hasDeptOversight,
            canRespond,
          );
          if (q) filters.push(q);
        } else if (me?.departmentId) {
          const q = this.buildQueueFilter(
            'myAssignments',
            userId,
            me?.departmentId ?? null,
            isAdmin,
            hasDeptOversight,
            canRespond,
          );
          if (q) filters.push(q);
          else return paginate([], 0, query);
        } else {
          return paginate([], 0, query);
        }
      }
      if (query.outgoing && !query.sourceApproval) {
        if (isAdmin) {
          // all outgoing — no extra filter
        } else if (hasDeptOversight && me?.departmentId) {
          filters.push({
            OR: [
              { fromDepartmentId: me.departmentId },
              { requestedById: userId },
            ],
          });
        } else {
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

  /**
   * Maps a workflow queue tab to a Prisma filter. Returns null when the caller
   * has no visibility for that queue (empty list, not an error).
   */
  private buildQueueFilter(
    queue: NonNullable<HelpRequestQueryDto['queue']>,
    userId: string,
    departmentId: string | null,
    isAdmin: boolean,
    hasDeptOversight: boolean,
    canRespond: boolean,
  ): Prisma.ComplaintHelpRequestWhereInput | null {
    switch (queue) {
      case 'sourceApproval':
        if (isAdmin) {
          return { status: HelpRequestStatus.PENDING_SOURCE_APPROVAL };
        }
        if (hasDeptOversight && departmentId) {
          return {
            fromDepartmentId: departmentId,
            status: HelpRequestStatus.PENDING_SOURCE_APPROVAL,
          };
        }
        return null;

      case 'incoming':
        if (isAdmin) {
          return { status: HelpRequestStatus.PENDING };
        }
        if (canRespond && departmentId) {
          return {
            toDepartmentId: departmentId,
            status: HelpRequestStatus.PENDING,
          };
        }
        return null;

      case 'needsAssignment':
        if (isAdmin) {
          return {
            status: HelpRequestStatus.ACCEPTED,
            helperAssigneeId: null,
          };
        }
        if (canRespond && departmentId) {
          return {
            toDepartmentId: departmentId,
            status: HelpRequestStatus.ACCEPTED,
            helperAssigneeId: null,
          };
        }
        return null;

      case 'inProgress':
        if (isAdmin) {
          return { status: HelpRequestStatus.IN_PROGRESS };
        }
        if (canRespond && departmentId) {
          return {
            toDepartmentId: departmentId,
            status: HelpRequestStatus.IN_PROGRESS,
          };
        }
        return null;

      case 'awaitingSourceReview':
        if (isAdmin) {
          return { status: HelpRequestStatus.SUBMITTED };
        }
        if (hasDeptOversight && departmentId) {
          return {
            fromDepartmentId: departmentId,
            status: HelpRequestStatus.SUBMITTED,
          };
        }
        return null;

      case 'myAssignments':
        return {
          helperAssigneeId: userId,
          status: {
            in: [
              HelpRequestStatus.IN_PROGRESS,
              HelpRequestStatus.SUBMITTED,
              HelpRequestStatus.ACCEPTED,
            ],
          },
        };

      case 'history':
        if (isAdmin) {
          return { status: { in: TERMINAL_HELP_STATUSES } };
        }
        if (!departmentId) return null;
        return {
          status: { in: TERMINAL_HELP_STATUSES },
          OR: [
            { fromDepartmentId: departmentId },
            { toDepartmentId: departmentId },
            { requestedById: userId },
            { helperAssigneeId: userId },
          ],
        };

      default:
        return null;
    }
  }

  async findOne(id: string, userId: string, municipalityId: string) {
    const hr = await this.loadOrFail(id, municipalityId);
    await this.assertCanRead(userId, hr);

    const [complaintContext, timeline] = await Promise.all([
      this.buildSafeComplaintContext(hr.complaintId, municipalityId),
      this.buildHelpTimeline(hr.complaintId),
    ]);

    return {
      ...hr,
      complaintContext,
      timeline,
    };
  }

  /** Pending help-request counts for inbox badges. */
  async pendingCount(
    userId: string,
    municipalityId: string,
  ): Promise<{
    count: number;
    receiverCount: number;
    sourceCount: number;
    needsAssignmentCount: number;
    inProgressCount: number;
    awaitingSourceReviewCount: number;
    myAssignmentsCount: number;
  }> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const perms = await this.permissions.getUserPermissions(userId);
    const isAdmin = perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    const hasDeptOversight =
      perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      perms.includes(PERMISSIONS.HELP_RESPOND);
    const canRespond = perms.includes(PERMISSIONS.HELP_RESPOND);
    const deptId = me?.departmentId;

    const empty = {
      count: 0,
      receiverCount: 0,
      sourceCount: 0,
      needsAssignmentCount: 0,
      inProgressCount: 0,
      awaitingSourceReviewCount: 0,
      myAssignmentsCount: 0,
    };

    const myAssignmentsCount = await this.prisma.complaintHelpRequest.count({
      where: {
        municipalityId,
        helperAssigneeId: userId,
        status: {
          in: [
            HelpRequestStatus.IN_PROGRESS,
            HelpRequestStatus.ACCEPTED,
          ],
        },
      },
    });

    if (isAdmin) {
      const [
        receiverCount,
        sourceCount,
        needsAssignmentCount,
        inProgressCount,
        awaitingSourceReviewCount,
      ] = await Promise.all([
        this.prisma.complaintHelpRequest.count({
          where: { municipalityId, status: HelpRequestStatus.PENDING },
        }),
        this.prisma.complaintHelpRequest.count({
          where: {
            municipalityId,
            status: HelpRequestStatus.PENDING_SOURCE_APPROVAL,
          },
        }),
        this.prisma.complaintHelpRequest.count({
          where: {
            municipalityId,
            status: HelpRequestStatus.ACCEPTED,
            helperAssigneeId: null,
          },
        }),
        this.prisma.complaintHelpRequest.count({
          where: { municipalityId, status: HelpRequestStatus.IN_PROGRESS },
        }),
        this.prisma.complaintHelpRequest.count({
          where: { municipalityId, status: HelpRequestStatus.SUBMITTED },
        }),
      ]);
      return {
        count: receiverCount,
        receiverCount,
        sourceCount,
        needsAssignmentCount,
        inProgressCount,
        awaitingSourceReviewCount,
        myAssignmentsCount,
      };
    }

    if (!deptId) {
      return { ...empty, myAssignmentsCount };
    }

    if (canRespond) {
      const [
        receiverCount,
        needsAssignmentCount,
        inProgressCount,
      ] = await Promise.all([
        this.prisma.complaintHelpRequest.count({
          where: {
            municipalityId,
            toDepartmentId: deptId,
            status: HelpRequestStatus.PENDING,
          },
        }),
        this.prisma.complaintHelpRequest.count({
          where: {
            municipalityId,
            toDepartmentId: deptId,
            status: HelpRequestStatus.ACCEPTED,
            helperAssigneeId: null,
          },
        }),
        this.prisma.complaintHelpRequest.count({
          where: {
            municipalityId,
            toDepartmentId: deptId,
            status: HelpRequestStatus.IN_PROGRESS,
          },
        }),
      ]);
      const sourceCount = hasDeptOversight
        ? await this.prisma.complaintHelpRequest.count({
            where: {
              municipalityId,
              fromDepartmentId: deptId,
              status: HelpRequestStatus.PENDING_SOURCE_APPROVAL,
            },
          })
        : 0;
      const awaitingSourceReviewCount = hasDeptOversight
        ? await this.prisma.complaintHelpRequest.count({
            where: {
              municipalityId,
              fromDepartmentId: deptId,
              status: HelpRequestStatus.SUBMITTED,
            },
          })
        : 0;
      return {
        count: receiverCount,
        receiverCount,
        sourceCount,
        needsAssignmentCount,
        inProgressCount,
        awaitingSourceReviewCount,
        myAssignmentsCount,
      };
    }

    if (hasDeptOversight) {
      const [sourceCount, awaitingSourceReviewCount] = await Promise.all([
        this.prisma.complaintHelpRequest.count({
          where: {
            municipalityId,
            fromDepartmentId: deptId,
            status: HelpRequestStatus.PENDING_SOURCE_APPROVAL,
          },
        }),
        this.prisma.complaintHelpRequest.count({
          where: {
            municipalityId,
            fromDepartmentId: deptId,
            status: HelpRequestStatus.SUBMITTED,
          },
        }),
      ]);
      return {
        ...empty,
        sourceCount,
        awaitingSourceReviewCount,
        myAssignmentsCount,
      };
    }

    return { ...empty, myAssignmentsCount };
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

    // Helper-side: never see pre-source-approval requests.
    if (!me?.departmentId) return [];
    const helperStatuses: HelpRequestStatus[] = [
      HelpRequestStatus.PENDING,
      HelpRequestStatus.ACCEPTED,
      HelpRequestStatus.IN_PROGRESS,
      HelpRequestStatus.SUBMITTED,
      HelpRequestStatus.COMPLETED,
      HelpRequestStatus.DECLINED,
      HelpRequestStatus.REJECTED,
      HelpRequestStatus.CANCELLED,
    ];
    return this.prisma.complaintHelpRequest.findMany({
      where: {
        complaintId,
        municipalityId,
        toDepartmentId: me.departmentId,
        status: { in: helperStatuses },
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

    // Source side (including worker requester while awaiting approval)
    if (hr.requestedById === userId) return;
    if (me?.departmentId && me.departmentId === hr.fromDepartmentId && hasDeptOversight) {
      return;
    }

    // Helper side — not visible until source approved
    if (
      hr.status === HelpRequestStatus.PENDING_SOURCE_APPROVAL ||
      hr.status === HelpRequestStatus.SOURCE_REJECTED
    ) {
      throw new ForbiddenException('You do not have access to this help request');
    }
    if (hr.helperAssigneeId === userId) return;

    if (me?.departmentId && me.departmentId === hr.toDepartmentId) {
      const isHelperHod =
        perms.includes(PERMISSIONS.HELP_RESPOND) &&
        (await this.isHodOf(userId, hr.toDepartmentId));
      if (isHelperHod) return;
      // Receiver Supervisor / HOD with dept visibility (field workers lack this)
      if (perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)) return;
    }

    throw new ForbiddenException('You do not have access to this help request');
  }

  /** Safe complaint snapshot for cross-dept help work (no citizen PII). */
  private async buildSafeComplaintContext(
    complaintId: string,
    municipalityId: string,
  ) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id: complaintId, municipalityId, deletedAt: null },
      select: {
        id: true,
        referenceCode: true,
        title: true,
        description: true,
        address: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        category: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
        department: { select: { id: true, name: true } },
        attachments: {
          where: { stage: AttachmentStage.SUBMISSION, deletedAt: null },
          select: {
            id: true,
            url: true,
            filename: true,
            mimeType: true,
            stage: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!complaint) return null;

    return {
      id: complaint.id,
      referenceCode: complaint.referenceCode,
      title: complaint.title,
      description: complaint.description,
      address: complaint.address,
      latitude: complaint.latitude?.toString() ?? null,
      longitude: complaint.longitude?.toString() ?? null,
      createdAt: complaint.createdAt,
      category: complaint.category,
      owningDepartment: complaint.department,
      attachments: complaint.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        filename: a.filename,
        mime: a.mimeType,
        stage: a.stage,
        createdAt: a.createdAt,
      })),
    };
  }

  /** Help workflow rows from the complaint status log. */
  private async buildHelpTimeline(complaintId: string) {
    const logs = await this.prisma.complaintStatusLog.findMany({
      where: {
        complaintId,
        eventKind: { in: HELP_EVENT_KIND_VALUES },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        eventKind: true,
        notes: true,
        createdAt: true,
        changedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    return logs;
  }

  private async assertCanApproveSource(
    userId: string,
    fromDepartmentId: string,
  ) {
    const perms = await this.permissions.getUserPermissions(userId);
    if (perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) return;

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (me?.departmentId !== fromDepartmentId) {
      throw new ForbiddenException(
        'You can only approve help requests from your own department.',
      );
    }
    if (await this.isHodOf(userId, fromDepartmentId)) return;
    if (perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)) return;

    throw new ForbiddenException(
      'Only your department Supervisor, Head of Department, or an Admin can approve outgoing help requests.',
    );
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
    if (perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) return;

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (me?.departmentId !== fromDepartmentId) {
      throw new ForbiddenException(
        'Only staff from the owning department can review helper work.',
      );
    }
    if (await this.isHodOf(userId, fromDepartmentId)) return;
    if (perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)) return;

    throw new ForbiddenException(
      'Only the requesting department Supervisor, Head of Department, or an Admin can approve/reject helper work.',
    );
  }

  private async isHodOf(userId: string, departmentId: string): Promise<boolean> {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { headUserId: true },
    });
    return dept?.headUserId === userId;
  }

  /** Source dept HOD (or admin fallback) when a worker raises a help request. */
  private async recipientsForFromDept(
    municipalityId: string,
    fromDepartmentId: string,
  ): Promise<string[]> {
    const dept = await this.prisma.department.findUnique({
      where: { id: fromDepartmentId },
      select: { headUserId: true },
    });
    if (dept?.headUserId) return [dept.headUserId];

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

  /**
   * Append a help-workflow event row to the complaint's status log. Uses
   * eventKind to mark the row as an event so the timeline UI does not
   * render it as a misleading same-status transition.
   *
   * We keep writing fromStatus = toStatus = current complaint status so
   * legacy clients that only look at status fields still see a row, while
   * the new UI groups by eventKind.
   */
  private async logHelpEvent(
    complaintId: string,
    changedById: string,
    eventKind: (typeof HELP_EVENT_KIND)[keyof typeof HELP_EVENT_KIND],
    notes: string,
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { status: true },
    });
    if (!complaint) return;
    await this.prisma.complaintStatusLog.create({
      data: {
        complaintId,
        changedById,
        fromStatus: complaint.status,
        toStatus: complaint.status,
        notes,
        eventKind,
      },
    });
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
    extraData?: Record<string, unknown>,
  ) {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    if (!ids.length) return;
    await this.notifications
      .createAndSend(hr.municipalityId, ids, type, title, body, {
        helpRequestId: hr.id,
        complaintId: hr.complaintId,
        referenceCode: hr.complaint?.referenceCode ?? undefined,
        deepLink: `/complaints/${hr.complaintId}`,
        ...extraData,
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
      sourceApprovedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      sourceRejectedBy: {
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
