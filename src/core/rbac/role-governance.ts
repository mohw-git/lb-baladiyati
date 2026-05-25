import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CITIZEN_ROLE_NAME,
  CITIZEN_PERMISSION_KEYS,
  DEFAULT_MUNICIPAL_ROLE_NAMES,
  isDefaultMunicipalRoleName,
  isPositionalSystemManagedRole,
} from './default-role.definitions';

export type RoleGovernanceSnapshot = {
  name: string;
  isSystem: boolean;
  isSystemManaged?: boolean;
  priority?: number;
};

/** Platform default municipal roles — immutable by municipality admins via API. */
export function isProtectedDefaultRole(role: RoleGovernanceSnapshot): boolean {
  return role.isSystem && isDefaultMunicipalRoleName(role.name);
}

export function assertMunicipalityAdminCanModifyRole(
  role: RoleGovernanceSnapshot,
  action: 'update' | 'delete' | 'set_permissions',
): void {
  if (!isProtectedDefaultRole(role)) {
    return;
  }
  const messages: Record<typeof action, string> = {
    update:
      'System roles are managed by the platform and cannot be modified by municipality admins.',
    delete:
      'System roles cannot be deleted. They are provisioned automatically for each municipality.',
    set_permissions:
      'Permissions on system roles are managed by the platform and cannot be changed by municipality admins.',
  };
  throw new ForbiddenException(messages[action]);
}

/** Citizen role may only hold citizen-safe permission keys. */
export async function assertCitizenRolePermissionKeys(
  roleName: string,
  permissionKeys: string[],
): Promise<void> {
  if (roleName !== CITIZEN_ROLE_NAME) {
    return;
  }
  const allowed = new Set(CITIZEN_PERMISSION_KEYS);
  const invalid = permissionKeys.filter((k) => !allowed.has(k));
  if (invalid.length) {
    throw new BadRequestException(
      `The Citizen role cannot include staff or admin permissions: ${invalid.join(', ')}`,
    );
  }
}

export function assertNotRenamingProtectedRole(
  role: RoleGovernanceSnapshot,
  newName?: string,
): void {
  if (newName && newName !== role.name && role.isSystem) {
    throw new BadRequestException('Cannot rename system roles');
  }
}

export {
  DEFAULT_MUNICIPAL_ROLE_NAMES,
  isDefaultMunicipalRoleName,
  isPositionalSystemManagedRole,
};
