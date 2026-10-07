import { PERMISSIONS } from '../constants/permissions';

export type CategoryAccessContext = {
  permissions: string[];
  userDepartmentId: string | null;
};

export type CategoryOwnership = {
  departmentId: string | null;
};

/** User can manage categories across the whole municipality (Admin, Assigner). */
export function hasMunicipalityWideCategoryManagement(
  permissions: string[],
): boolean {
  if (
    permissions.includes(PERMISSIONS.DEPARTMENT_CREATE) ||
    permissions.includes(PERMISSIONS.DEPARTMENT_UPDATE) ||
    permissions.includes(PERMISSIONS.MUNICIPALITY_UPDATE)
  ) {
    return true;
  }

  const hasCategoryManagement =
    permissions.includes(PERMISSIONS.CATEGORY_CREATE) ||
    permissions.includes(PERMISSIONS.CATEGORY_UPDATE) ||
    permissions.includes(PERMISSIONS.CATEGORY_DELETE);

  return (
    hasCategoryManagement &&
    permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
  );
}

export function isDepartmentScopedCategoryManager(
  ctx: CategoryAccessContext,
): boolean {
  const hasCategoryManagement =
    ctx.permissions.includes(PERMISSIONS.CATEGORY_CREATE) ||
    ctx.permissions.includes(PERMISSIONS.CATEGORY_UPDATE) ||
    ctx.permissions.includes(PERMISSIONS.CATEGORY_DELETE);

  return hasCategoryManagement && !hasMunicipalityWideCategoryManagement(ctx.permissions);
}

export function assertCanManageCategory(
  ctx: CategoryAccessContext,
  category: CategoryOwnership,
): void {
  if (hasMunicipalityWideCategoryManagement(ctx.permissions)) return;

  if (!isDepartmentScopedCategoryManager(ctx)) {
    throw new CategoryAccessError(
      'You do not have permission to manage categories',
    );
  }

  if (!ctx.userDepartmentId) {
    throw new CategoryAccessError(
      'You must be assigned to a department to manage categories',
    );
  }

  if (category.departmentId === null) {
    throw new CategoryAccessError(
      'Municipality-wide categories can only be managed by municipality administrators',
    );
  }

  if (category.departmentId !== ctx.userDepartmentId) {
    throw new CategoryAccessError(
      'You can only manage categories belonging to your department',
    );
  }
}

/** Validates department assignment on create / update. */
export function resolveCategoryDepartmentId(
  ctx: CategoryAccessContext,
  requestedDepartmentId: string | null | undefined,
): string | null {
  if (hasMunicipalityWideCategoryManagement(ctx.permissions)) {
    return requestedDepartmentId ?? null;
  }

  if (!ctx.userDepartmentId) {
    throw new CategoryAccessError(
      'You must be assigned to a department to manage categories',
    );
  }

  if (requestedDepartmentId == null || requestedDepartmentId === '') {
    throw new CategoryAccessError(
      'Municipality-wide categories can only be created by municipality administrators',
    );
  }

  if (requestedDepartmentId !== ctx.userDepartmentId) {
    throw new CategoryAccessError(
      'You can only assign categories to your own department',
    );
  }

  return ctx.userDepartmentId;
}

export function assertDepartmentChangeAllowed(
  ctx: CategoryAccessContext,
  currentDepartmentId: string | null,
  newDepartmentId: string | null | undefined,
): void {
  if (newDepartmentId === undefined) return;

  const normalizedNew = newDepartmentId ?? null;

  if (normalizedNew === currentDepartmentId) return;

  if (!hasMunicipalityWideCategoryManagement(ctx.permissions)) {
    throw new CategoryAccessError(
      'You cannot move categories between departments',
    );
  }
}

export class CategoryAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryAccessError';
  }
}
