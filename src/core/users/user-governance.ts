import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma, UserCreatedVia } from '@prisma/client';

export type UserGovernanceSnapshot = {
  id?: string;
  createdVia: UserCreatedVia;
  departmentId?: string | null;
  isActive?: boolean;
  userRoles?: { role: { name: string; isSystemManaged?: boolean } }[];
};

export function getRoleNames(user: UserGovernanceSnapshot): string[] {
  return user.userRoles?.map((ur) => ur.role.name) ?? [];
}

export function isSelfRegisteredCitizen(user: {
  createdVia: UserCreatedVia;
}): boolean {
  return user.createdVia === 'SELF_REGISTRATION';
}

/** True when the user holds only the Citizen role (or no roles yet). */
export function isCitizenOnlyAccount(user: UserGovernanceSnapshot): boolean {
  const names = getRoleNames(user);
  return names.length === 0 || names.every((n) => n === 'Citizen');
}

/**
 * Accounts that must never receive staff department membership, staff roles,
 * or elevation through municipality admin APIs.
 */
export function isProtectedCitizenAccount(
  user: UserGovernanceSnapshot,
): boolean {
  return isSelfRegisteredCitizen(user) || isCitizenOnlyAccount(user);
}

export function assertCanAssignRoleToUser(
  user: UserGovernanceSnapshot,
  roleName: string,
): void {
  if (roleName !== 'Citizen' && isProtectedCitizenAccount(user)) {
    throw new ForbiddenException(
      'Citizen accounts cannot be granted staff roles. Create a separate staff account instead.',
    );
  }
}

export function assertCanSetUserDepartment(
  user: UserGovernanceSnapshot,
  departmentId: string | null | undefined,
): void {
  if (departmentId && isProtectedCitizenAccount(user)) {
    throw new ForbiddenException(
      'Citizen accounts cannot be assigned to a department. Create a separate staff account instead.',
    );
  }
}

export function assertCanRemoveCitizenRole(
  user: UserGovernanceSnapshot,
  roleName: string,
): void {
  if (roleName === 'Citizen' && isProtectedCitizenAccount(user)) {
    throw new ForbiddenException(
      'The Citizen role cannot be removed from a protected citizen account.',
    );
  }
}

export function assertEligibleStaffAssignee(
  user: UserGovernanceSnapshot,
): void {
  if (user.isActive === false) {
    throw new BadRequestException('Assignee must be an active account.');
  }
  if (isProtectedCitizenAccount(user)) {
    throw new BadRequestException(
      'Citizen accounts cannot be assigned staff work. Choose a staff member.',
    );
  }
}

/** Prisma filter: staff eligible for department membership / assignment lists. */
export function staffMemberWhere(
  extra?: Prisma.UserWhereInput,
): Prisma.UserWhereInput {
  return {
    AND: [
      extra ?? {},
      { createdVia: { not: UserCreatedVia.SELF_REGISTRATION } },
      {
        userRoles: {
          some: { role: { name: { not: 'Citizen' } } },
        },
      },
    ],
  };
}

/** Prisma filter for complaint/helper/transfer assignee pickers. */
export function staffAssignableWhere(
  extra?: Prisma.UserWhereInput,
): Prisma.UserWhereInput {
  return staffMemberWhere({
    isActive: true,
    ...extra,
  });
}

/** Citizens tab: self-registered or citizen-only role holders. */
export function protectedCitizenListWhere(
  extra?: Prisma.UserWhereInput,
): Prisma.UserWhereInput {
  return {
    AND: [
      extra ?? {},
      {
        OR: [
          { createdVia: UserCreatedVia.SELF_REGISTRATION },
          {
            userRoles: {
              some: { role: { name: 'Citizen' } },
              none: { role: { name: { not: 'Citizen' } } },
            },
          },
        ],
      },
    ],
  };
}
