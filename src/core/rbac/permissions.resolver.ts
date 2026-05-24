import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_PERMISSIONS } from './permissions.constants';

@Injectable()
export class PermissionsResolver {
  constructor(private prisma: PrismaService) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    // Super admins automatically get every permission
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    if (user?.isSuperAdmin) {
      return [...ALL_PERMISSIONS];
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      if (userRole.role.deletedAt) continue;
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return Array.from(permissions);
  }

  async getUserRoleNames(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          select: { name: true, deletedAt: true },
        },
      },
    });

    const roleNames = userRoles
      .filter((ur) => !ur.role.deletedAt)
      .map((ur) => ur.role.name);

    if (user?.isSuperAdmin) {
      return ['Super Admin', ...roleNames];
    }

    return roleNames;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    return user?.isSuperAdmin ?? false;
  }
}
