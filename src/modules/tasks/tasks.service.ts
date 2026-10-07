import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TaskStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { paginate } from '../../core/common/dto/pagination.dto';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { assertEligibleStaffAssignee } from '../../core/users/user-governance';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { ChangeTaskStatusDto } from './dto/task-status.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsResolver,
    private audit: AuditService,
    private notifications: NotificationsService,
    private realtime: RealtimeService,
  ) {}

  // ============================================================
  // CRUD
  // ============================================================

  async create(
    municipalityId: string,
    creator: { id: string; email: string; departmentId?: string | null },
    dto: CreateTaskDto,
    req?: Request,
  ) {
    // Validate department belongs to this municipality
    const dept = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, municipalityId, deletedAt: null },
    });
    if (!dept) throw new NotFoundException('Department not found');

    // If pre-assigning, the assignee must be a member of the same department
    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedToId, municipalityId, isActive: true },
        include: {
          userRoles: { include: { role: { select: { name: true } } } },
        },
      });
      if (!assignee) throw new NotFoundException('Assignee not found');
      assertEligibleStaffAssignee({
        createdVia: assignee.createdVia,
        isActive: assignee.isActive,
        userRoles: assignee.userRoles,
      });
      if (assignee.departmentId !== dto.departmentId) {
        throw new BadRequestException(
          'You can only pre-assign someone in the same department. ' +
            'For cross-department work, create the task and then open a transfer request.',
        );
      }
    }

    const task = await this.prisma.task.create({
      data: {
        municipalityId,
        departmentId: dto.departmentId,
        createdById: creator.id,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assignedToId: dto.assignedToId ?? null,
        status: dto.assignedToId ? TaskStatus.IN_PROGRESS : TaskStatus.NEW,
      },
      include: this.includeRelations(),
    });

    await this.audit.logFromRequest(req, {
      actorId: creator.id,
      actorEmail: creator.email,
      municipalityId,
      action: 'task.create',
      resourceType: 'Task',
      resourceId: task.id,
      metadata: { title: task.title, departmentId: dto.departmentId },
    });

    if (task.assignedToId) {
      await this.notifications
        .createAndSend(
          municipalityId,
          [task.assignedToId],
          NotificationType.TASK_ASSIGNED,
          'New task assigned',
          `You have been assigned: ${task.title}`,
          { taskId: task.id },
        )
        .catch(() => undefined);
    }

    this.realtime.emit(
      'task:created',
      { id: task.id },
      {
        municipalityId: task.municipalityId,
        departmentId: task.departmentId,
        userIds: task.assignedToId ? [task.assignedToId] : [],
      },
    );

    return task;
  }

  async findAll(userId: string, municipalityId: string, query: TaskQueryDto) {
    const perms = await this.permissions.getUserPermissions(userId);
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    const where: any = { municipalityId, deletedAt: null };
    const filters: any[] = [];

    // Permission scoping (hierarchical, like complaints)
    if (perms.includes(PERMISSIONS.TASK_VIEW_ALL)) {
      // see everything
    } else if (perms.includes(PERMISSIONS.TASK_VIEW_DEPARTMENT) && me?.departmentId) {
      filters.push({ departmentId: me.departmentId });
    } else if (perms.includes(PERMISSIONS.TASK_VIEW_ASSIGNED)) {
      filters.push({ OR: [{ assignedToId: userId }, { createdById: userId }] });
    } else {
      // No task permissions at all → empty result
      return paginate([], 0, query);
    }

    if (query.status) filters.push({ status: query.status });
    if (query.priority) filters.push({ priority: query.priority });
    if (query.departmentId) filters.push({ departmentId: query.departmentId });
    if (query.assignedToId) filters.push({ assignedToId: query.assignedToId });
    if (query.myAssignments) filters.push({ assignedToId: userId });
    if (query.myTasks) filters.push({ createdById: userId });
    if (query.q) {
      filters.push({ title: { contains: query.q, mode: 'insensitive' } });
    }

    if (filters.length) where.AND = filters;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.includeRelations(),
      }),
      this.prisma.task.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string, userId: string, municipalityId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, municipalityId, deletedAt: null },
      include: this.includeRelations(),
    });
    if (!task) throw new NotFoundException('Task not found');

    // Authorization: TASK_VIEW_ALL, OR member of dept (with view_department), OR creator/assignee
    const perms = await this.permissions.getUserPermissions(userId);
    if (!perms.includes(PERMISSIONS.TASK_VIEW_ALL)) {
      const me = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      const isDeptMember =
        perms.includes(PERMISSIONS.TASK_VIEW_DEPARTMENT) &&
        me?.departmentId === task.departmentId;
      const isInvolved = task.createdById === userId || task.assignedToId === userId;
      if (!isDeptMember && !isInvolved) {
        throw new ForbiddenException('Not allowed to view this task');
      }
    }

    return task;
  }

  async update(
    id: string,
    userId: string,
    municipalityId: string,
    dto: UpdateTaskDto,
    req?: Request,
  ) {
    const existing = await this.findOne(id, userId, municipalityId);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: this.includeRelations(),
    });

    const actor = await this.actor(userId);
    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: actor?.email,
      municipalityId,
      action: 'task.update',
      resourceType: 'Task',
      resourceId: id,
      metadata: { fields: Object.keys(dto), title: existing.title },
    });

    return updated;
  }

  async remove(id: string, userId: string, municipalityId: string, req?: Request) {
    const task = await this.findOne(id, userId, municipalityId);
    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    const actor = await this.actor(userId);
    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: actor?.email,
      municipalityId,
      action: 'task.delete',
      resourceType: 'Task',
      resourceId: id,
      metadata: { title: task.title },
    });
    return { ok: true };
  }

  // ============================================================
  // STATUS + ASSIGN
  // ============================================================

  async changeStatus(
    id: string,
    userId: string,
    municipalityId: string,
    dto: ChangeTaskStatusDto,
    req?: Request,
  ) {
    const task = await this.findOne(id, userId, municipalityId);

    // Workers can only move their own tasks
    const perms = await this.permissions.getUserPermissions(userId);
    const canManageAll =
      perms.includes(PERMISSIONS.TASK_VIEW_ALL) ||
      perms.includes(PERMISSIONS.TASK_VIEW_DEPARTMENT);
    if (!canManageAll && task.assignedToId !== userId) {
      throw new ForbiddenException('You can only change the status of tasks assigned to you');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === TaskStatus.DONE ? new Date() : null,
      },
      include: this.includeRelations(),
    });

    const actor = await this.actor(userId);
    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: actor?.email,
      municipalityId,
      action: 'task.status.change',
      resourceType: 'Task',
      resourceId: id,
      metadata: { from: task.status, to: dto.status, notes: dto.notes },
    });

    // Notify creator on completion
    if (
      dto.status === TaskStatus.DONE &&
      task.createdById !== userId &&
      task.createdById
    ) {
      await this.notifications
        .createAndSend(
          municipalityId,
          [task.createdById],
          NotificationType.TASK_STATUS_CHANGED,
          'Task completed',
          `Task "${task.title}" has been marked as done.`,
          { taskId: id },
        )
        .catch(() => undefined);
    }

    this.realtime.taskUpdated({
      id: updated.id,
      municipalityId: updated.municipalityId,
      departmentId: updated.departmentId,
      assigneeId: updated.assignedToId,
    });

    return updated;
  }

  /**
   * INTRA-DEPARTMENT assignment. The assignee MUST belong to the same
   * department as the task. Cross-dept moves go through TransferRequest.
   */
  async assign(
    id: string,
    assigneeId: string,
    userId: string,
    municipalityId: string,
    req?: Request,
  ) {
    const task = await this.findOne(id, userId, municipalityId);

    if (assigneeId === userId) {
      throw new BadRequestException('You cannot assign a task to yourself from here');
    }

    const assignee = await this.prisma.user.findFirst({
      where: { id: assigneeId, municipalityId, isActive: true },
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });
    if (!assignee) throw new NotFoundException('Assignee not found');
    assertEligibleStaffAssignee({
      createdVia: assignee.createdVia,
      isActive: assignee.isActive,
      userRoles: assignee.userRoles,
    });

    if (assignee.departmentId !== task.departmentId) {
      throw new BadRequestException(
        'Cross-department assignment is not allowed. ' +
          'Open a transfer request — the receiving department\'s Head will accept and assign internally.',
      );
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        assignedToId: assigneeId,
        status: task.status === TaskStatus.NEW ? TaskStatus.IN_PROGRESS : task.status,
      },
      include: this.includeRelations(),
    });

    const actor = await this.actor(userId);
    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: actor?.email,
      municipalityId,
      action: 'task.assign',
      resourceType: 'Task',
      resourceId: id,
      metadata: { assigneeId, assigneeEmail: assignee.email },
    });

    await this.notifications
      .createAndSend(
        municipalityId,
        [assigneeId],
        NotificationType.TASK_ASSIGNED,
        'New task assigned',
        `You have been assigned: ${task.title}`,
        { taskId: id },
      )
      .catch(() => undefined);

    this.realtime.taskUpdated({
      id: updated.id,
      municipalityId: updated.municipalityId,
      departmentId: updated.departmentId,
      assigneeId: updated.assignedToId,
    });

    return updated;
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private async actor(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
  }

  private includeRelations() {
    return {
      department: { select: { id: true, name: true } },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    } as const;
  }
}
