import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';

export type DepartmentAccessContext = {
  permissions: string[];
  userDepartmentId: string | null;
};

/** Admin, assigner, and department managers — full department directory access. */
export function hasMunicipalityWideDepartmentAccess(permissions: string[]): boolean {
  return (
    permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
    permissions.includes(PERMISSIONS.USER_VIEW_ALL) ||
    permissions.includes(PERMISSIONS.DEPARTMENT_CREATE) ||
    permissions.includes(PERMISSIONS.DEPARTMENT_UPDATE)
  );
}

/**
 * Cross-department pickers (help request, transfer) need id + name for all departments,
 * but must not expose head/staff counts to department-scoped roles.
 */
export function canListDepartmentsForRouting(permissions: string[]): boolean {
  return (
    hasMunicipalityWideDepartmentAccess(permissions) ||
    permissions.includes(PERMISSIONS.HELP_REQUEST) ||
    permissions.includes(PERMISSIONS.TRANSFER_REQUEST)
  );
}

export function assertCanAccessDepartmentDetails(
  ctx: DepartmentAccessContext,
  departmentId: string,
): void {
  if (hasMunicipalityWideDepartmentAccess(ctx.permissions)) return;
  if (ctx.userDepartmentId && ctx.userDepartmentId === departmentId) return;
  throw new ForbiddenException('You do not have access to this department');
}
