import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ComplaintStatus,
  NotificationType,
  TaskStatus,
  TransferStatus,
  TransferTargetType,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { paginate } from '../../core/common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import {
  AcceptTransferRequestDto,
  CreateTransferRequestDto,
  RejectTransferRequestDto,
  TransferQueryDto,
} from './dto/transfer.dto';

interface ResolvedTarget {
  id: string;
  municipalityId: string;
  departmentId: string | null;
  title: string;
}

/**
 * Cross-department transfer-request service.
 *
 * Workflow:
 *   1. Source side opens a request   (PENDING)
 *   2. Receiving HOD accepts          (ACCEPTED, target moves + new assignee set)
 *      OR rejects                    (REJECTED, target stays put)
 *      OR original requester cancels (CANCELLED, target stays put)
 *
 * Polymorphic via (targetType, targetId) so the same flow works for
 * citizen Complaints AND internal Tasks.
 */
@Injectable()
export class TransfersService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsResolver,
    private audit: AuditService,
    private notifications: NotificationsService,
    private realtime: RealtimeService,
  ) {}

  // ============================================================
  // CREATE
  // ============================================================

  async create(
    user: { id: string; email: string; municipalityId: string },
    dto: CreateTransferRequestDto,
    req?: Request,
  ) {
    const target = await this.resolveTarget(
      dto.targetType,
      dto.targetId,
      user.municipalityId,
    );
    if (!target.departmentId) {
      throw new BadRequestException(
        'The target item has no current department — cannot transfer.',
      );
    }
    if (target.departmentId === dto.toDepartmentId) {
      throw new BadRequestException(
        'Target is already in this department. Use direct assignment instead.',
      );
    }

    // Receiving department must exist in the same municipality
    const toDept = await this.prisma.department.findFirst({
      where: {
        id: dto.toDepartmentId,
        municipalityId: user.municipalityId,
        deletedAt: null,
      },
    });
    if (!toDept) throw new NotFoundException('Receiving department not found');

    // Rule: only Supervisor / HOD / Admin can initiate (handled by controller via TRANSFER_REQUEST permission)
    // Additional rule: requester must belong to the source dept (or be Admin with TASK_VIEW_ALL)
    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    const perms = await this.permissions.getUserPermissions(user.id);
    const isPrivileged =
      perms.includes('complaint.view_all') || perms.includes('task.view_all');
    if (!isPrivileged && me?.departmentId !== target.departmentId) {
      throw new ForbiddenException(
        'You can only request transfers for items in your own department.',
      );
    }

    // No duplicate pending requests for the same target
    const dupe = await this.prisma.transferRequest.findFirst({
      where: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: TransferStatus.PENDING,
      },
    });
    if (dupe) {
      throw new BadRequestException(
        'A pending transfer request already exists for this item.',
      );
    }

    const transfer = await this.prisma.transferRequest.create({
      data: {
        municipalityId: user.municipalityId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        fromDepartmentId: target.departmentId,
        toDepartmentId: dto.toDepartmentId,
        requestedById: user.id,
        reason: dto.reason,
      },
      include: this.includeRelations(),
    });

    // Notify the receiving department's HOD (if any) + Admins of the muni
    const recipientIds = await this.recipientsForToDept(
      user.municipalityId,
      dto.toDepartmentId,
    );
    if (recipientIds.length) {
      await this.notifications
        .createAndSend(
          user.municipalityId,
          recipientIds,
          NotificationType.TRANSFER_REQUESTED,
          'Incoming transfer request',
          `${target.title} — incoming from ${transfer.fromDepartment.name}`,
          { transferId: transfer.id, targetType: dto.targetType, targetId: dto.targetId },
        )
        .catch(() => undefined);
    }

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: 'transfer.request',
      resourceType: dto.targetType,
      resourceId: dto.targetId,
      metadata: {
        transferId: transfer.id,
        from: target.departmentId,
        to: dto.toDepartmentId,
        reason: dto.reason,
      },
    });

    this.realtime.emit(
      'transfer:created',
      { id: transfer.id },
      {
        municipalityId: user.municipalityId,
        // emit to both departments so the badge counts update everywhere
        departmentId: dto.toDepartmentId,
      },
    );
    if (target.departmentId && target.departmentId !== dto.toDepartmentId) {
      this.realtime.emit(
        'transfer:created',
        { id: transfer.id },
        {
          municipalityId: user.municipalityId,
          departmentId: target.departmentId,
        },
      );
    }

    return transfer;
  }

  // ============================================================
  // ACCEPT
  // ============================================================

  async accept(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: AcceptTransferRequestDto,
    req?: Request,
  ) {
    const transfer = await this.prisma.transferRequest.findFirst({
      where: { id, municipalityId: user.municipalityId },
      include: this.includeRelations(),
    });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(
        `Transfer is already ${transfer.status.toLowerCase()}`,
      );
    }

    // Authorization: caller must be HOD of the receiving dept (or Admin)
    await this.assertCanRespond(user.id, transfer.toDepartmentId, user.municipalityId);

    // The new assignee must be in the receiving department and active
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: dto.newAssigneeId,
        municipalityId: user.municipalityId,
        departmentId: transfer.toDepartmentId,
        isActive: true,
      },
    });
    if (!assignee) {
      throw new BadRequestException(
        'The chosen assignee is not a member of the receiving department.',
      );
    }

    // Atomic: update target's department + assignee, then mark transfer accepted
    await this.prisma.$transaction(async (tx) => {
      if (transfer.targetType === TransferTargetType.COMPLAINT) {
        await tx.complaint.update({
          where: { id: transfer.targetId },
          data: {
            departmentId: transfer.toDepartmentId,
            status: ComplaintStatus.ASSIGNED,
          },
        });
        await tx.complaintStatusLog.create({
          data: {
            complaintId: transfer.targetId,
            changedById: user.id,
            fromStatus: ComplaintStatus.ASSIGNED,
            toStatus: ComplaintStatus.ASSIGNED,
            notes: `Transfer accepted from ${transfer.fromDepartment.name} → ${transfer.toDepartment.name}. Assigned to ${assignee.firstName} ${assignee.lastName}.`,
          },
        });
        await tx.complaintAssignment.create({
          data: {
            complaintId: transfer.targetId,
            assignedToId: dto.newAssigneeId,
            assignedById: user.id,
            notes: `Cross-department transfer (request ${transfer.id})`,
          },
        });
      } else {
        await tx.task.update({
          where: { id: transfer.targetId },
          data: {
            departmentId: transfer.toDepartmentId,
            assignedToId: dto.newAssigneeId,
            status: TaskStatus.IN_PROGRESS,
          },
        });
      }

      await tx.transferRequest.update({
        where: { id },
        data: {
          status: TransferStatus.ACCEPTED,
          respondedById: user.id,
          respondedAt: new Date(),
          newAssigneeId: dto.newAssigneeId,
          responseReason: dto.note,
        },
      });
    });

    // Notify original requester + new assignee
    const notifyIds = Array.from(
      new Set([transfer.requestedById, dto.newAssigneeId]),
    );
    await this.notifications
      .createAndSend(
        user.municipalityId,
        notifyIds,
        NotificationType.TRANSFER_ACCEPTED,
        'Transfer accepted',
        `${transfer.fromDepartment.name} → ${transfer.toDepartment.name}: assigned to ${assignee.firstName} ${assignee.lastName}`,
        { transferId: transfer.id, targetType: transfer.targetType, targetId: transfer.targetId },
      )
      .catch(() => undefined);

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: 'transfer.accept',
      resourceType: transfer.targetType,
      resourceId: transfer.targetId,
      metadata: {
        transferId: id,
        newAssigneeId: dto.newAssigneeId,
        toDepartmentId: transfer.toDepartmentId,
      },
    });

    this.realtime.transferUpdated({
      id,
      municipalityId: user.municipalityId,
      fromDepartmentId: transfer.fromDepartmentId,
      toDepartmentId: transfer.toDepartmentId,
    });

    return this.findOne(id, user.id, user.municipalityId);
  }

  // ============================================================
  // REJECT
  // ============================================================

  async reject(
    id: string,
    user: { id: string; email: string; municipalityId: string },
    dto: RejectTransferRequestDto,
    req?: Request,
  ) {
    const transfer = await this.prisma.transferRequest.findFirst({
      where: { id, municipalityId: user.municipalityId },
      include: this.includeRelations(),
    });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(
        `Transfer is already ${transfer.status.toLowerCase()}`,
      );
    }

    await this.assertCanRespond(user.id, transfer.toDepartmentId, user.municipalityId);

    await this.prisma.transferRequest.update({
      where: { id },
      data: {
        status: TransferStatus.REJECTED,
        respondedById: user.id,
        respondedAt: new Date(),
        responseReason: dto.reason,
      },
    });

    await this.notifications
      .createAndSend(
        user.municipalityId,
        [transfer.requestedById],
        NotificationType.TRANSFER_REJECTED,
        'Transfer rejected',
        `Your transfer to ${transfer.toDepartment.name} was rejected: ${dto.reason}`,
        { transferId: id, targetType: transfer.targetType, targetId: transfer.targetId },
      )
      .catch(() => undefined);

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: 'transfer.reject',
      resourceType: transfer.targetType,
      resourceId: transfer.targetId,
      metadata: { transferId: id, reason: dto.reason },
    });

    this.realtime.transferUpdated({
      id,
      municipalityId: user.municipalityId,
      fromDepartmentId: transfer.fromDepartmentId,
      toDepartmentId: transfer.toDepartmentId,
    });

    return this.findOne(id, user.id, user.municipalityId);
  }

  // ============================================================
  // CANCEL (by requester)
  // ============================================================

  async cancel(id: string, userId: string, municipalityId: string, req?: Request) {
    const transfer = await this.prisma.transferRequest.findFirst({
      where: { id, municipalityId },
    });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }
    if (transfer.requestedById !== userId) {
      throw new ForbiddenException(
        'Only the original requester can cancel a transfer',
      );
    }

    await this.prisma.transferRequest.update({
      where: { id },
      data: {
        status: TransferStatus.CANCELLED,
        respondedById: userId,
        respondedAt: new Date(),
      },
    });

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: actor?.email,
      municipalityId,
      action: 'transfer.cancel',
      resourceType: transfer.targetType,
      resourceId: transfer.targetId,
      metadata: { transferId: id },
    });

    return { ok: true };
  }

  // ============================================================
  // QUERY
  // ============================================================

  async findAll(userId: string, municipalityId: string, query: TransferQueryDto) {
    const where: any = { municipalityId };
    const filters: any[] = [];

    if (query.status) filters.push({ status: query.status });
    if (query.targetType) filters.push({ targetType: query.targetType });

    if (query.inbox) {
      // Only requests for departments where I'm a member (HOD or Admin)
      const me = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      const perms = await this.permissions.getUserPermissions(userId);
      const isAdmin = perms.includes('complaint.view_all');
      if (!isAdmin && me?.departmentId) {
        filters.push({ toDepartmentId: me.departmentId });
      } else if (!isAdmin) {
        return paginate([], 0, query);
      }
    }

    if (query.outgoing) {
      filters.push({ requestedById: userId });
    }

    if (filters.length) where.AND = filters;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const [items, total] = await Promise.all([
      this.prisma.transferRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { status: 'asc' }, // PENDING first
          { createdAt: 'desc' },
        ],
        include: this.includeRelations(),
      }),
      this.prisma.transferRequest.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string, _userId: string, municipalityId: string) {
    const transfer = await this.prisma.transferRequest.findFirst({
      where: { id, municipalityId },
      include: this.includeRelations(),
    });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    return transfer;
  }

  /** All pending transfers for the user's department (HOD inbox count). */
  async pendingCount(userId: string, municipalityId: string): Promise<number> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const perms = await this.permissions.getUserPermissions(userId);
    const isAdmin = perms.includes('complaint.view_all');

    if (isAdmin) {
      return this.prisma.transferRequest.count({
        where: { municipalityId, status: TransferStatus.PENDING },
      });
    }
    if (!me?.departmentId) return 0;
    return this.prisma.transferRequest.count({
      where: {
        municipalityId,
        toDepartmentId: me.departmentId,
        status: TransferStatus.PENDING,
      },
    });
  }

  /** Transfer history for a single complaint or task (for the timeline strip). */
  async historyFor(
    targetType: TransferTargetType,
    targetId: string,
    municipalityId: string,
  ) {
    return this.prisma.transferRequest.findMany({
      where: { targetType, targetId, municipalityId },
      orderBy: { createdAt: 'asc' },
      include: this.includeRelations(),
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async resolveTarget(
    type: TransferTargetType,
    id: string,
    municipalityId: string,
  ): Promise<ResolvedTarget> {
    if (type === TransferTargetType.COMPLAINT) {
      const c = await this.prisma.complaint.findFirst({
        where: { id, municipalityId, deletedAt: null },
        select: {
          id: true,
          municipalityId: true,
          departmentId: true,
          title: true,
        },
      });
      if (!c) throw new NotFoundException('Complaint not found');
      return c;
    }
    const t = await this.prisma.task.findFirst({
      where: { id, municipalityId, deletedAt: null },
      select: { id: true, municipalityId: true, departmentId: true, title: true },
    });
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  private async assertCanRespond(
    userId: string,
    departmentId: string,
    municipalityId: string,
  ) {
    const perms = await this.permissions.getUserPermissions(userId);
    if (!perms.includes('transfer.respond')) {
      throw new ForbiddenException('You do not have permission to respond to transfers');
    }
    // Admins can respond on behalf of any department
    const isAdmin = perms.includes('complaint.view_all');
    if (isAdmin) return;
    // Otherwise require HOD slot ownership
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { headUserId: true },
    });
    if (dept?.headUserId !== userId) {
      throw new ForbiddenException(
        'Only the Head of the receiving department (or Admin) can respond to this transfer',
      );
    }
  }

  /** HOD of the target dept + all Admins of the municipality. */
  private async recipientsForToDept(
    municipalityId: string,
    toDepartmentId: string,
  ): Promise<string[]> {
    const dept = await this.prisma.department.findUnique({
      where: { id: toDepartmentId },
      select: { headUserId: true },
    });
    const admins = await this.prisma.user.findMany({
      where: {
        municipalityId,
        isActive: true,
        userRoles: { some: { role: { name: 'Admin' } } },
      },
      select: { id: true },
    });
    const ids = admins.map((a) => a.id);
    if (dept?.headUserId) ids.push(dept.headUserId);
    return Array.from(new Set(ids));
  }

  private includeRelations() {
    return {
      fromDepartment: { select: { id: true, name: true } },
      toDepartment: { select: { id: true, name: true } },
      requestedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      respondedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      newAssignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    } as const;
  }
}
