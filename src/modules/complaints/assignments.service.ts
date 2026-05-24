import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ComplaintStatus } from '@prisma/client';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { RealtimeService } from '../../core/realtime/realtime.service';

@Injectable()
export class AssignmentsService {
  constructor(
    private prisma: PrismaService,
    private permissionsResolver: PermissionsResolver,
    private audit: AuditService,
    private realtime: RealtimeService,
  ) {}

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
        isActive: true,
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

    // Citizens cannot be assigned to complaints — only staff (Worker/Supervisor/HOD/Admin/Verifier)
    const assigneeRoles = assignee.userRoles.map((ur) => ur.role.name);
    const isCitizen =
      assigneeRoles.length === 0 ||
      (assigneeRoles.length === 1 && assigneeRoles[0] === 'Citizen');
    if (isCitizen) {
      throw new BadRequestException(
        'Citizens cannot be assigned complaints. Only staff members can be assigned.',
      );
    }

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

    // Deactivate any existing active assignments
    await this.prisma.complaintAssignment.updateMany({
      where: {
        complaintId,
        isActive: true,
      },
      data: { isActive: false },
    });

    // Create new assignment
    const assignment = await this.prisma.complaintAssignment.create({
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

    // Update complaint status to ASSIGNED if currently SUBMITTED
    if (complaint.status === ComplaintStatus.SUBMITTED) {
      await this.prisma.complaint.update({
        where: { id: complaintId },
        data: { status: ComplaintStatus.ASSIGNED },
      });

      // Log status change
      await this.prisma.complaintStatusLog.create({
        data: {
          complaintId,
          changedById: assignedById,
          fromStatus: complaint.status,
          toStatus: ComplaintStatus.ASSIGNED,
          notes: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
        },
      });
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
    return this.prisma.complaintAssignment.findFirst({
      where: {
        complaintId,
        isActive: true,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async isAssignedTo(complaintId: string, userId: string): Promise<boolean> {
    const assignment = await this.prisma.complaintAssignment.findFirst({
      where: {
        complaintId,
        assignedToId: userId,
        isActive: true,
      },
    });
    return !!assignment;
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
      where: {
        municipalityId,
        isActive: true,
        id: {
          notIn: [complaint.createdById, requesterId].filter(Boolean) as string[],
        },
        // Same-department only when the complaint is bound to one. Cross-dept
        // moves still go through the transfer flow.
        ...(complaint.departmentId
          ? { departmentId: complaint.departmentId }
          : {}),
        // Exclude self-registered citizens — assignees must be staff.
        createdVia: { not: 'SELF_REGISTRATION' as any },
      },
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
