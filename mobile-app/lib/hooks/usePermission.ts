import { useAuthStore } from '../auth/store';

// Stable empty array to avoid infinite re-renders
const EMPTY_PERMISSIONS: string[] = [];

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
  HELP_VIEW:    'help.view',
  // Cross-department transfers (full handoff)
  TRANSFER_REQUEST: 'transfer.request',
  TRANSFER_RESPOND: 'transfer.respond',
  TRANSFER_VIEW:    'transfer.view',
} as const;

/**
 * Get permissions with stable reference for empty array
 */
function usePermissions(): string[] {
  const perms = useAuthStore((s) => s.user?.permissions);
  return perms ?? EMPTY_PERMISSIONS;
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
 * Determine user's role type for UI decisions
 */
export function useUserRole(): 'citizen' | 'worker' | 'supervisor' | 'admin' {
  const permissions = usePermissions();
  
  // Admin has all permissions
  if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) && permissions.length > 20) {
    return 'admin';
  }
  
  // Supervisor/HOD can verify or approve
  if (
    permissions.includes(PERMISSIONS.COMPLAINT_VERIFY) ||
    permissions.includes(PERMISSIONS.COMPLAINT_APPROVE) ||
    permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)
  ) {
    return 'supervisor';
  }
  
  // Field worker can view assigned
  if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
    return 'worker';
  }
  
  // Default to citizen
  return 'citizen';
}

/**
 * Check if user is a field worker (assigned tasks view)
 */
export function useIsWorker(): boolean {
  const role = useUserRole();
  return role === 'worker' || role === 'supervisor' || role === 'admin';
}

/**
 * Check if user can perform status change
 */
export function useCanChangeStatus(): boolean {
  return useHasPermission(PERMISSIONS.COMPLAINT_CHANGE_STATUS);
}
