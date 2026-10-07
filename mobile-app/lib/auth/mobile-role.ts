/**
 * Mobile shell routing: only users with the Field Worker role get worker mode.
 * Admins, supervisors, HOD, verifiers, assigners, and citizens use citizen-style tabs.
 */

export type MobileExperience = 'citizen' | 'worker';

export type AccountKind =
  | 'citizen'
  | 'field_worker'
  | 'supervisor'
  | 'admin'
  | 'staff';

function normalizeRoleToken(role: string): string {
  return role.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** True when the role name/slug is Field Worker (any common spelling). */
export function isFieldWorkerRoleName(role: string): boolean {
  const token = normalizeRoleToken(role);
  return token === 'field_worker' || token === 'fieldworker';
}

export function userHasFieldWorkerRole(roles: string[] | undefined | null): boolean {
  return (roles ?? []).some(isFieldWorkerRoleName);
}

export function userHasCitizenRole(roles: string[] | undefined | null): boolean {
  return (roles ?? []).some((r) => normalizeRoleToken(r) === 'citizen');
}

export function resolveMobileExperience(roles: string[] | undefined | null): MobileExperience {
  return userHasFieldWorkerRole(roles) ? 'worker' : 'citizen';
}

/** Display label for profile badge — from role names, not permission heuristics. */
export function resolveAccountKind(roles: string[] | undefined | null): AccountKind {
  const list = roles ?? [];
  if (list.length === 0) return 'citizen';

  const tokens = list.map(normalizeRoleToken);

  if (tokens.some((t) => t === 'citizen')) return 'citizen';
  if (tokens.some((t) => t === 'super_admin' || t === 'admin' || t === 'municipal_admin')) {
    return 'admin';
  }
  if (
    tokens.some(
      (t) =>
        t === 'supervisor' ||
        t === 'head_of_department' ||
        t === 'hod' ||
        t === 'department_head',
    )
  ) {
    return 'supervisor';
  }
  if (tokens.some(isFieldWorkerRoleName)) return 'field_worker';

  return 'staff';
}
