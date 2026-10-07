import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import {
  isProtectedCitizenAccount,
  type UserGovernanceSnapshot,
} from '../../core/users/user-governance';

const TRIAGE_PERMISSION_KEYS = [
  PERMISSIONS.COMPLAINT_VIEW_ALL,
  PERMISSIONS.COMPLAINT_ASSIGN,
  PERMISSIONS.COMPLAINT_CLASSIFY,
] as const;

const staffUserSelect = {
  id: true,
  createdVia: true,
  isSuperAdmin: true,
  userRoles: {
    select: {
      role: { select: { name: true, isSystemManaged: true } },
    },
  },
} as const;

@Injectable()
export class NotificationRecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Municipality triage queue: Admin, Assigner, and others who can view/assign
   * all complaints. Excludes citizens and platform super-admins.
   */
  async findComplaintTriageRecipientIds(municipalityId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        municipalityId,
        isActive: true,
        isSuperAdmin: false,
        userRoles: {
          some: {
            role: {
              rolePermissions: {
                some: {
                  permission: { key: { in: [...TRIAGE_PERMISSION_KEYS] } },
                },
              },
            },
          },
        },
      },
      select: staffUserSelect,
    });

    return this.toStaffRecipientIds(users);
  }

  /**
   * Department oversight: active staff in the target department with
   * complaint.view_department (HOD, Supervisor, etc.).
   */
  async findDepartmentComplaintRecipientIds(
    municipalityId: string,
    departmentId: string,
  ): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        municipalityId,
        isActive: true,
        isSuperAdmin: false,
        departmentId,
        userRoles: {
          some: {
            role: {
              rolePermissions: {
                some: {
                  permission: { key: PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT },
                },
              },
            },
          },
        },
      },
      select: staffUserSelect,
    });

    const fromRoles = this.toStaffRecipientIds(users);

    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, municipalityId, deletedAt: null },
      select: { headUserId: true },
    });
    if (dept?.headUserId) {
      fromRoles.push(dept.headUserId);
    }

    return Array.from(new Set(fromRoles));
  }

  /** Active self-registered / citizen-only accounts in a municipality (for news push). */
  async findCitizenRecipientIds(municipalityId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        municipalityId,
        isActive: true,
        isSuperAdmin: false,
      },
      select: staffUserSelect,
    });

    return users
      .filter((u) => isProtectedCitizenAccount(u as UserGovernanceSnapshot))
      .map((u) => u.id);
  }

  /** Municipality staff (non-citizen) for in-app-only broadcasts such as news. */
  async findStaffRecipientIds(municipalityId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        municipalityId,
        isActive: true,
        isSuperAdmin: false,
      },
      select: staffUserSelect,
    });

    return this.toStaffRecipientIds(users);
  }

  private toStaffRecipientIds(
    users: Array<{
      id: string;
      createdVia: UserGovernanceSnapshot['createdVia'];
      isSuperAdmin: boolean;
      userRoles: UserGovernanceSnapshot['userRoles'];
    }>,
  ): string[] {
    return users
      .filter(
        (u) =>
          !u.isSuperAdmin && !isProtectedCitizenAccount(u as UserGovernanceSnapshot),
      )
      .map((u) => u.id);
  }
}
