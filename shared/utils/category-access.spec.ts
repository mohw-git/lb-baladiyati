import { PERMISSIONS } from '../constants/permissions';
import {
  assertCanManageCategory,
  assertDepartmentChangeAllowed,
  hasMunicipalityWideCategoryManagement,
  isDepartmentScopedCategoryManager,
  resolveCategoryDepartmentId,
} from './category-access';

const adminPerms = [
  PERMISSIONS.DEPARTMENT_CREATE,
  PERMISSIONS.CATEGORY_CREATE,
  PERMISSIONS.CATEGORY_UPDATE,
  PERMISSIONS.COMPLAINT_VIEW_ALL,
];

const assignerPerms = [
  PERMISSIONS.COMPLAINT_VIEW_ALL,
  PERMISSIONS.CATEGORY_CREATE,
  PERMISSIONS.CATEGORY_UPDATE,
  PERMISSIONS.CATEGORY_DELETE,
];

const hodPerms = [
  PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
  PERMISSIONS.CATEGORY_CREATE,
  PERMISSIONS.CATEGORY_UPDATE,
];

describe('category-access', () => {
  it('treats Admin and Assigner as municipality-wide managers', () => {
    expect(hasMunicipalityWideCategoryManagement(adminPerms)).toBe(true);
    expect(hasMunicipalityWideCategoryManagement(assignerPerms)).toBe(true);
  });

  it('treats HOD as department-scoped manager', () => {
    const ctx = { permissions: hodPerms, userDepartmentId: 'dept-a' };
    expect(hasMunicipalityWideCategoryManagement(hodPerms)).toBe(false);
    expect(isDepartmentScopedCategoryManager(ctx)).toBe(true);
  });

  it('allows HOD to manage own department categories only', () => {
    const ctx = { permissions: hodPerms, userDepartmentId: 'dept-a' };
    expect(() =>
      assertCanManageCategory(ctx, { departmentId: 'dept-a' }),
    ).not.toThrow();
    expect(() =>
      assertCanManageCategory(ctx, { departmentId: 'dept-b' }),
    ).toThrow(/your department/);
    expect(() =>
      assertCanManageCategory(ctx, { departmentId: null }),
    ).toThrow(/Municipality-wide categories/);
  });

  it('forces HOD create department to own department', () => {
    const ctx = { permissions: hodPerms, userDepartmentId: 'dept-a' };
    expect(resolveCategoryDepartmentId(ctx, 'dept-a')).toBe('dept-a');
    expect(() => resolveCategoryDepartmentId(ctx, 'dept-b')).toThrow(
      /your own department/,
    );
    expect(() => resolveCategoryDepartmentId(ctx, null)).toThrow(
      /Municipality-wide categories/,
    );
  });

  it('blocks HOD from moving categories between departments', () => {
    const ctx = { permissions: hodPerms, userDepartmentId: 'dept-a' };
    expect(() =>
      assertDepartmentChangeAllowed(ctx, 'dept-a', 'dept-b'),
    ).toThrow(/move categories/);
  });

  it('allows Assigner to move categories between departments', () => {
    const ctx = { permissions: assignerPerms, userDepartmentId: null };
    expect(() =>
      assertDepartmentChangeAllowed(ctx, 'dept-a', 'dept-b'),
    ).not.toThrow();
  });
});
