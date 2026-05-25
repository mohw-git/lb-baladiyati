import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ComplaintStatus, Prisma } from '@prisma/client';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import {
  assertEligibleStaffAssignee,
  staffAssignableWhere,
} from '../../core/users/user-governance';

@Injectable()
export class AssignmentsService {
  constructor(
    private prisma: PrismaService,
    private permissionsResolver: PermissionsResolver,
    private audit: AuditService,
    private realtime: RealtimeService,
  ) {}

  /**
   * Statuses at which a complaint can be (re)assigned. Once work has actually
   * started (IN_PROGRESS / PENDING_APPROVAL) or the complaint has been closed,
   * we refuse to re-route silently — supervisor must move it back via the
   * normal status workflow first. This protects worker progress / audit trail.
   */
  private static readonly ASSIGNABLE_STATUSES: ComplaintStatus[] = [
    ComplaintStatus.SUBMITTED,
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.ASSIGNED,
  ];

  async assignComplaint(
    complaintId: string,
    assignedToId: string,
    assignedById: string,
    municipalityId: string,
    notes?: string,
  ) {
    // Verify complaint exists and belongs to municipality
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Status gate — the complaint must be in a state that accepts assignment.
    // Without this check, callers could silently reassign IN_PROGRESS work
    // and break the worker's flow, or "reassign" closed complaints.
    if (!AssignmentsService.ASSIGNABLE_STATUSES.includes(complaint.status)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_STATUS_FOR_ASSIGNMENT',
        message: `Cannot assign while complaint is ${complaint.status}. Move it back to UNDER_REVIEW first if you need to reassign.`,
      });
    }

    // Cannot assign a complaint to its creator (citizen who submitted it)
    if (assignedToId === complaint.createdById) {
      throw new BadRequestException(
        'Cannot assign a complaint to the user who submitted it',
      );
    }

    // Cannot self-assign without higher-level approval flow (kept simple: just block it)
    if (assignedToId === assignedById) {
      throw new BadRequestException('Cannot assign a complaint to yourself');
    }

    // Verify assignee exists and belongs to same municipality
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: assignedToId,
        municipalityId,
      },
      include: {
        userRoles: {
          include: { role: { select: { name: true } } },
        },
      },
    });

    if (!assignee) {
      throw new NotFoundException('Assignee not found');
    }

    assertEligibleStaffAssignee({
      createdVia: assignee.createdVia,
      isActive: assignee.isActive,
      userRoles: assignee.userRoles,
    });

    // Cross-department assignment is NOT allowed via direct assign — it must
    // go through the transfer-request workflow so the receiving department's
    // HOD explicitly accepts the work.
    if (complaint.departmentId && assignee.departmentId !== complaint.departmentId) {
      throw new BadRequestException(
        'Cross-department assignment is not allowed. Open a transfer request — the receiving department\'s Head will accept and assign internally.',
      );
    }

    // Verify the assigner has authority over this department
    const assignerPermissions = await this.permissionsResolver.getUserPermissions(assignedById);
    const isAdmin = assignerPermissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);

    if (!isAdmin) {
      const assigner = await this.prisma.user.findUnique({
        where: { id: assignedById },
        select: { departmentId: true },
      });

      if (complaint.departmentId && assigner?.departmentId !== complaint.departmentId) {
        throw new ForbiddenException(
          'You can only assign complaints within your own department',
        );
      }
    }

    // Wrap deactivate + status-bump + new assignment in one transaction so
    // two concurrent assigns can't both succeed and leave the complaint
    // with duplicate active rows or a half-transitioned status. The
    // complaint update is gated on the expected prior status (atomic
    // compare-and-set); race losers get a clean 409.
    let assignment: Prisma.ComplaintAssignmentGetPayload<{
      include: {
        assignedTo: { select: { id: true; firstName: true; lastName: true } };
        assignedBy: { select: { id: true; firstName: true; lastName: true } };
      };
    }>;
    try {
      assignment = await this.prisma.$transaction(async (tx) => {
        await tx.complaintAssignment.updateMany({
          where: { complaintId, isActive: true },
          data: { isActive: false },
        });

        const created = await tx.complaintAssignment.create({
          data: {
            complaintId,
            assignedToId,
            assignedById,
            notes,
            isActive: true,
          },
          include: {
            assignedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
            assignedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        // Auto-transition pre-work statuses to ASSIGNED so the worker isn't
        // stuck. Without this a UNDER_REVIEW complaint that gets assigned
        // would keep its status and the worker couldn't legally move to
        // IN_PROGRESS next (state machine only allows ASSIGNED → IN_PROGRESS).
        if (
          complaint.status === ComplaintStatus.SUBMITTED ||
          complaint.status === ComplaintStatus.UNDER_REVIEW
        ) {
          await tx.complaint.update({
            where: { id: complaintId, status: complaint.status, deletedAt: null },
            data: { status: ComplaintStatus.ASSIGNED },
          });
          await tx.complaintStatusLog.create({
            data: {
              complaintId,
              changedById: assignedById,
              fromStatus: complaint.status,
              toStatus: ComplaintStatus.ASSIGNED,
              notes: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
            },
          });
        } else if (complaint.status === ComplaintStatus.ASSIGNED) {
          // Reassignment — record it as an event, not a fake ASSIGNED → ASSIGNED
          // status transition. Frontend renders eventKind rows as events.
          await tx.complaintStatusLog.create({
            data: {
              complaintId,
              changedById: assignedById,
              fromStatus: complaint.status,
              toStatus: ComplaintStatus.ASSIGNED,
              notes: `Reassigned to ${assignee.firstName} ${assignee.lastName}`,
              eventKind: 'REASSIGNED',
            },
          });
        }

        return created;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new ConflictException({
          statusCode: 409,
          code: 'COMPLAINT_STATE_CONFLICT',
          message:
            'This complaint was just updated by someone else. Refresh and try again.',
        });
      }
      throw err;
    }

    // Audit
    const assigner = await this.prisma.user.findUnique({
      where: { id: assignedById },
      select: { email: true },
    });
    await this.audit.log({
      actorId: assignedById,
      actorEmail: assigner?.email,
      municipalityId,
      action: AUDIT_ACTIONS.COMPLAINT_ASSIGN,
      resourceType: 'Complaint',
      resourceId: complaintId,
      metadata: {
        assigneeId: assignedToId,
        assigneeName: `${assignee.firstName} ${assignee.lastName}`,
        assigneeEmail: assignee.email,
        notes,
      },
    });

    // Realtime: assignee + dept + creator + muni see "complaint updated"
    this.realtime.complaintUpdated({
      id: complaintId,
      municipalityId,
      departmentId: complaint.departmentId,
      createdById: complaint.createdById,
      assignedUserIds: [assignedToId],
    });

    return {
      complaintId,
      assignedTo: assignment.assignedTo,
      assignedBy: assignment.assignedBy,
      notes: assignment.notes,
      status: ComplaintStatus.ASSIGNED,
      createdAt: assignment.createdAt,
    };
  }

  async getActiveAssignment(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { departmentId: true },
    });

    const assignment = await this.prisma.complaintAssignment.findFirst({
      where: {
        complaintId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            departmentId: true,
          },
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!assignment) return null;
    if (
      complaint?.departmentId &&
      assignment.assignedTo.departmentId &&
      complaint.departmentId !== assignment.assignedTo.departmentId
    ) {
      return null;
    }
    return assignment;
  }

  /**
   * End all active assignments for a complaint. Used before re-assign,
   * cross-department transfer accept, and whenever a complaint reaches a
   * terminal status (COMPLETED / REJECTED / CLOSED) so workload counts /
   * "Assigned to me" never carry stale closed work.
   *
   * Accepts an in-progress transaction client; falls back to the singleton
   * Prisma client when called outside a transaction.
   */
  async deactivateActiveAssignments(
    complaintId: string,
    tx?: { complaintAssignment: { updateMany: any } } | any,
  ) {
    const db = (tx?.complaintAssignment ?? this.prisma.complaintAssignment) as {
      updateMany: (args: any) => Promise<any>;
    };
    await db.updateMany({
      where: { complaintId, isActive: true },
      data: { isActive: false },
    });
  }

  /**
   * True when the user has the active assignment AND the complaint still
   * belongs to their department (post-transfer complaints in another dept do not count).
   */
  async isAssignedTo(complaintId: string, userId: string): Promise<boolean> {
    const assignment = await this.prisma.complaintAssignment.findFirst({
      where: {
        complaintId,
        assignedToId: userId,
        isActive: true,
      },
      select: {
        complaint: { select: { departmentId: true } },
      },
    });
    if (!assignment) return false;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (!user?.departmentId || !assignment.complaint.departmentId) {
      return true;
    }
    return assignment.complaint.departmentId === user.departmentId;
  }

  /** Prisma filter: active assignment to user, complaint in user's department when set. */
  buildActiveAssignmentVisibilityFilter(
    userId: string,
    departmentId: string | null | undefined,
  ) {
    const filters: object[] = [
      { assignments: { some: { assignedToId: userId, isActive: true } } },
    ];
    if (departmentId) {
      filters.push({ departmentId });
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  /**
   * Repair data: keep only the newest active assignment per complaint.
   * Safe to run repeatedly; does not delete history.
   */
  async repairDuplicateActiveAssignments(): Promise<{ complaintsFixed: number }> {
    const active = await this.prisma.complaintAssignment.findMany({
      where: { isActive: true },
      select: { id: true, complaintId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const deactivateIds: string[] = [];
    const seen = new Set<string>();
    for (const row of active) {
      if (seen.has(row.complaintId)) {
        deactivateIds.push(row.id);
      } else {
        seen.add(row.complaintId);
      }
    }
    if (deactivateIds.length) {
      await this.prisma.complaintAssignment.updateMany({
        where: { id: { in: deactivateIds } },
        data: { isActive: false },
      });
    }
    return { complaintsFixed: seen.size };
  }

  /**
   * List the staff members eligible to be assigned to a given complaint, with
   * each candidate's current active workload. Used by the Assign modal so the
   * dispatcher can balance load manually instead of guessing.
   *
   * Eligibility rules (mirrors `assignComplaint`):
   *   - same municipality
   *   - not the citizen who submitted the complaint
   *   - not the dispatcher themselves
   *   - if the complaint has a department, only that department's staff
   *   - active accounts only
   *   - not Citizen-only role
   */
  async listAssignableUsers(
    complaintId: string,
    requesterId: string,
    municipalityId: string,
  ) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id: complaintId, municipalityId, deletedAt: null },
      select: {
        id: true,
        createdById: true,
        departmentId: true,
      },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const candidates = await this.prisma.user.findMany({
      where: staffAssignableWhere({
        municipalityId,
        id: {
          notIn: [complaint.createdById, requesterId].filter(Boolean) as string[],
        },
        ...(complaint.departmentId
          ? { departmentId: complaint.departmentId }
          : {}),
      }),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        userRoles: {
          select: { role: { select: { name: true } } },
        },
        // Count of active complaint assignments — the workload signal.
        _count: {
          select: {
            assignmentsReceived: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    // Sort lightest-load first manually (Prisma can't orderBy a filtered
    // _count). Tie-broken by name (already alphabetical from the SQL).
    const out = candidates.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      avatarUrl: u.avatarUrl,
      roles: u.userRoles
        .map((ur) => ur.role.name)
        .filter((n) => n !== 'Citizen'),
      activeAssignments: (u as any)._count?.assignmentsReceived ?? 0,
    }));
    out.sort((a, b) => a.activeAssignments - b.activeAssignments);
    return out;
  }
}
