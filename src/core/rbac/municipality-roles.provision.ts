import { Prisma } from '@prisma/client';
import {
  getAdminPermissionKeys,
  getDefaultRoleConfigs,
  isPositionalSystemManagedRole,
} from './default-role.definitions';

type DbClient = Prisma.TransactionClient | {
  permission: Prisma.TransactionClient['permission'];
  role: Prisma.TransactionClient['role'];
  rolePermission: Prisma.TransactionClient['rolePermission'];
};

/**
 * Creates (or returns existing) default municipal roles with correct
 * priority, isSystem, isSystemManaged, and permission sets.
 */
export async function provisionDefaultMunicipalityRoles(
  db: DbClient,
  municipalityId: string,
): Promise<Record<string, string>> {
  const permissions = await db.permission.findMany();
  const permsByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const roleIds: Record<string, string> = {};

  for (const roleConfig of getDefaultRoleConfigs()) {
    const existing = await db.role.findUnique({
      where: {
        municipalityId_name: { municipalityId, name: roleConfig.name },
      },
    });

    const permissionKeys =
      roleConfig.name === 'Admin'
        ? getAdminPermissionKeys()
        : roleConfig.permissions;

    const roleData = {
      municipalityId,
      name: roleConfig.name,
      nameAr: roleConfig.nameAr ?? null,
      nameFr: roleConfig.nameFr ?? null,
      description: roleConfig.description ?? null,
      descriptionAr: roleConfig.descriptionAr ?? null,
      descriptionFr: roleConfig.descriptionFr ?? null,
      isSystem: true,
      priority: roleConfig.priority,
      isSystemManaged: isPositionalSystemManagedRole(roleConfig.name),
    };

    let roleId: string;
    if (existing) {
      await db.role.update({
        where: { id: existing.id },
        data: roleData,
      });
      roleId = existing.id;
    } else {
      const created = await db.role.create({ data: roleData });
      roleId = created.id;
    }

    roleIds[roleConfig.name] = roleId;

    const desiredPermIds = new Set(
      permissionKeys
        .map((k) => permsByKey.get(k))
        .filter((id): id is string => !!id),
    );

    const current = await db.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { key: true, id: true } } },
    });

    for (const rp of current) {
      if (!desiredPermIds.has(rp.permissionId)) {
        await db.rolePermission.delete({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId: rp.permissionId,
            },
          },
        });
      }
    }

    for (const permId of desiredPermIds) {
      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId: permId },
        },
        create: { roleId, permissionId: permId },
        update: {},
      });
    }
  }

  return roleIds;
}
