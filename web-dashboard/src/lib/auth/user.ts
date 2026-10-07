import type { AuthUserWithRoles } from '@shared/types/auth';
import { CITIZEN_PERMISSIONS } from '@shared/constants/permissions';

/** True when the account is a self-registered or Citizen-only user. */
export function isCitizenAccount(
  user: Pick<AuthUserWithRoles, 'accountType' | 'roles'> | null | undefined,
): boolean {
  if (!user) return false;
  if (user.accountType === 'CITIZEN') return true;
  if (user.accountType === 'STAFF') return false;
  const roles = user.roles ?? [];
  return roles.length === 1 && roles[0] === 'Citizen';
}

/**
 * Merge a fresh `/auth/me` (or login) payload into the session user.
 * Citizens receive stripped staff fields from the API; permissions are
 * restored locally for route guards.
 */
export function mergeAuthProfile(
  previous: AuthUserWithRoles | null,
  fresh: AuthUserWithRoles,
): AuthUserWithRoles {
  if (!isCitizenAccount(fresh)) {
    return { ...fresh, accountType: fresh.accountType ?? 'STAFF' };
  }

  const permissions =
    fresh.permissions && fresh.permissions.length > 0
      ? fresh.permissions
      : previous?.permissions && previous.permissions.length > 0
        ? previous.permissions
        : [...CITIZEN_PERMISSIONS];

  return {
    ...fresh,
    accountType: 'CITIZEN',
    roles: [],
    rolesDetailed: [],
    department: null,
    permissions,
    isSuperAdmin: false,
    effectiveRank: undefined,
    mustEnrollTwoFactor: false,
  };
}
