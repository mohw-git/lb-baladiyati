'use client';

import { useAuthStore } from './store';
import type { PermissionKey } from '@shared/constants/permissions';

/** Get the current authenticated user */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const logout = useAuthStore((s) => s.logout);

  return {
    user,
    isAuthenticated: !!user,
    isLoading: !isHydrated,
    logout,
  };
}

/** Check if user has a specific permission */
export function usePermission(permission: PermissionKey | string): boolean {
  const user = useAuthStore((s) => s.user);
  return user?.permissions?.includes(permission) ?? false;
}

/** Check if user has ANY of the given permissions */
export function useAnyPermission(...permissions: (PermissionKey | string)[]): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user?.permissions) return false;
  return permissions.some((p) => user.permissions!.includes(p));
}

/** Check if user has ALL of the given permissions */
export function useAllPermissions(...permissions: (PermissionKey | string)[]): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user?.permissions) return false;
  return permissions.every((p) => user.permissions!.includes(p));
}

/** Get user display name */
export function useUserName(): string {
  const user = useAuthStore((s) => s.user);
  if (!user) return '';
  return `${user.firstName} ${user.lastName}`;
}
