import { useAuthStore } from '../auth/store';
import {
  resolveAccountKind,
  resolveMobileExperience,
  userHasCitizenRole,
  userHasFieldWorkerRole,
  type AccountKind,
  type MobileExperience,
} from '../auth/mobile-role';

// Stable empty array to avoid infinite re-renders
const EMPTY_PERMISSIONS: string[] = [];
const EMPTY_ROLES: string[] = [];

export const PERMISSIONS = {
  // Complaints
  COMPLAINT_CREATE: 'complaint.create',
  COMPLAINT_VIEW_OWN: 'complaint.view_own',
  COMPLAINT_VIEW_ALL: 'complaint.view_all',
  COMPLAINT_VIEW_ASSIGNED: 'complaint.view_assigned',
  COMPLAINT_VIEW_DEPARTMENT: 'complaint.view_department',
  COMPLAINT_ASSIGN: 'complaint.assign',
  COMPLAINT_CHANGE_STATUS: 'complaint.change_status',
  COMPLAINT_UPLOAD_ATTACHMENT: 'complaint.upload_attachment',
  COMPLAINT_VERIFY: 'complaint.verify',
  COMPLAINT_APPROVE: 'complaint.approve',
  COMPLAINT_REJECT: 'complaint.reject',
  COMPLAINT_SET_PRIORITY: 'complaint.set_priority',
  // Cross-department help requests (no transfer of ownership)
  HELP_REQUEST: 'help.request',
  HELP_RESPOND: 'help.respond',
  HELP_VIEW: 'help.view',
  // Cross-department transfers (full handoff)
  TRANSFER_REQUEST: 'transfer.request',
  TRANSFER_RESPOND: 'transfer.respond',
  TRANSFER_VIEW: 'transfer.view',
} as const;

/**
 * Get permissions with stable reference for empty array
 */
function usePermissions(): string[] {
  const perms = useAuthStore((s) => s.user?.permissions);
  return perms ?? EMPTY_PERMISSIONS;
}

function useRoleNames(): string[] {
  const roles = useAuthStore((s) => s.user?.roles);
  return roles ?? EMPTY_ROLES;
}

/**
 * Check if user has ANY of the specified permissions
 */
export function useHasAnyPermission(...permissions: string[]): boolean {
  const userPermissions = usePermissions();
  return permissions.some((p) => userPermissions.includes(p));
}

/**
 * Check if user has ALL of the specified permissions
 */
export function useHasAllPermissions(...permissions: string[]): boolean {
  const userPermissions = usePermissions();
  return permissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if user has a specific permission
 */
export function useHasPermission(permission: string): boolean {
  const userPermissions = usePermissions();
  return userPermissions.includes(permission);
}

/**
 * Mobile shell: citizen-style tabs for everyone except Field Worker role holders.
 */
export function useMobileExperience(): MobileExperience {
  const roles = useRoleNames();
  return resolveMobileExperience(roles);
}

/** True only when the user has the Field Worker role (not admin/supervisor by permission). */
export function useIsFieldWorker(): boolean {
  return userHasFieldWorkerRole(useRoleNames());
}

/**
 * @deprecated Prefer useIsFieldWorker — same meaning after mobile role split.
 */
export function useIsWorker(): boolean {
  return useIsFieldWorker();
}

/** True for citizen mobile shell (citizens + municipal staff except field workers). */
export function useCitizenMobileExperience(): boolean {
  return useMobileExperience() === 'citizen';
}

export function useHasCitizenRole(): boolean {
  return userHasCitizenRole(useRoleNames());
}

/** Profile badge / copy — derived from assigned role names. */
export function useAccountKind(): AccountKind {
  return resolveAccountKind(useRoleNames());
}

/**
 * Legacy UI role helper — maps account kind to previous union for gradual migration.
 * Do not use for tab routing; use useMobileExperience / useIsFieldWorker instead.
 */
export function useUserRole(): 'citizen' | 'worker' | 'supervisor' | 'admin' {
  const kind = useAccountKind();
  if (kind === 'field_worker') return 'worker';
  if (kind === 'supervisor') return 'supervisor';
  if (kind === 'admin') return 'admin';
  return 'citizen';
}

/**
 * Check if user can perform status change (permission-based — unchanged for worker actions).
 */
export function useCanChangeStatus(): boolean {
  return useHasPermission(PERMISSIONS.COMPLAINT_CHANGE_STATUS);
}
