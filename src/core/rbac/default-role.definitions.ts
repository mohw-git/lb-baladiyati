import {
  DEFAULT_ROLES,
  PERMISSIONS,
  TENANT_ADMIN_PERMISSIONS,
} from './permissions.constants';

/** Canonical municipal role names provisioned for every municipality. */
export const DEFAULT_MUNICIPAL_ROLE_NAMES = Object.values(DEFAULT_ROLES).map(
  (r) => r.name,
) as readonly string[];

export const CITIZEN_ROLE_NAME = 'Citizen';

/** Higher numeric priority = stronger authority (Discord-style). */
export const DEFAULT_ROLE_PRIORITIES: Record<string, number> = {
  [CITIZEN_ROLE_NAME]: 0,
  'Field Worker': 30,
  Verifier: 50,
  Assigner: 50,
  Supervisor: 60,
  'Head of Department': 80,
  Admin: 100,
};

/** Positional slots — not assignable via generic role picker (Admin / HOD). */
export function isPositionalSystemManagedRole(name: string): boolean {
  return name === 'Admin' || name === 'Head of Department';
}

export function isDefaultMunicipalRoleName(name: string): boolean {
  return (DEFAULT_MUNICIPAL_ROLE_NAMES as readonly string[]).includes(name);
}

export function getDefaultRolePriority(name: string): number {
  return DEFAULT_ROLE_PRIORITIES[name] ?? 0;
}

export const CITIZEN_PERMISSION_KEYS: string[] = [
  ...DEFAULT_ROLES.CITIZEN.permissions,
];

export type DefaultRoleConfig = (typeof DEFAULT_ROLES)[keyof typeof DEFAULT_ROLES] & {
  priority: number;
};

/** Role configs with explicit priority for provisioning / repair. */
export function getDefaultRoleConfigs(): DefaultRoleConfig[] {
  return Object.values(DEFAULT_ROLES).map((config) => ({
    ...config,
    priority: getDefaultRolePriority(config.name),
  }));
}

/** Admin receives all tenant permissions (no platform.*). */
export function getAdminPermissionKeys(): string[] {
  return TENANT_ADMIN_PERMISSIONS;
}

/** Keys that must never be stripped from Citizen during repair. */
export { PERMISSIONS };
