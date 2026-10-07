import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { HierarchyResolver } from '../../core/rbac/hierarchy.resolver';
import {
  assertCitizenRolePermissionKeys,
  assertMunicipalityAdminCanModifyRole,
  assertNotRenamingProtectedRole,
  isDefaultMunicipalRoleName,
} from '../../core/rbac/role-governance';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private hierarchy: HierarchyResolver,
  ) {}

  async findAllPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
    return { data: permissions };
  }

  async findAll(municipalityId: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        municipalityId,
        deletedAt: null,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' as any }, { name: 'asc' }],
    });

    return {
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        nameAr: (role as any).nameAr ?? null,
        nameFr: (role as any).nameFr ?? null,
        description: role.description,
        descriptionAr: (role as any).descriptionAr ?? null,
        descriptionFr: (role as any).descriptionFr ?? null,
        isSystem: role.isSystem,
        isSystemManaged: (role as any).isSystemManaged ?? false,
        priority: (role as any).priority ?? 0,
        permissions: role.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          key: rp.permission.key,
          name: rp.permission.name,
        })),
        createdAt: role.createdAt,
      })),
    };
  }

  async findOne(id: string, municipalityId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        municipalityId,
        deletedAt: null,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      nameAr: (role as any).nameAr ?? null,
      nameFr: (role as any).nameFr ?? null,
      description: role.description,
      descriptionAr: (role as any).descriptionAr ?? null,
      descriptionFr: (role as any).descriptionFr ?? null,
      isSystem: role.isSystem,
      isSystemManaged: (role as any).isSystemManaged ?? false,
      priority: (role as any).priority ?? 0,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        key: rp.permission.key,
        name: rp.permission.name,
      })),
      createdAt: role.createdAt,
    };
  }

  async create(municipalityId: string, dto: CreateRoleDto, actorId?: string) {
    if (isDefaultMunicipalRoleName(dto.name)) {
      throw new ConflictException(
        `"${dto.name}" is a reserved system role name. Choose a different name for custom roles.`,
      );
    }

    const existing = await this.prisma.role.findFirst({
      where: {
        municipalityId,
        name: dto.name,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Role with this name already exists');
    }

    const priority = dto.priority ?? 0;
    if (actorId) {
      await this.hierarchy.assertCanSetPriority(actorId, priority);
    }

    const role = await this.prisma.role.create({
      data: {
        municipalityId,
        name: dto.name,
        nameAr: dto.nameAr,
        nameFr: dto.nameFr,
        description: dto.description,
        descriptionAr: dto.descriptionAr,
        descriptionFr: dto.descriptionFr,
        priority,
        isSystem: false,
        isSystemManaged: false,
      } as any,
    });

    if (dto.permissionIds?.length) {
      const perms = await this.prisma.permission.findMany({
        where: { id: { in: dto.permissionIds } },
        select: { key: true },
      });
      await assertCitizenRolePermissionKeys(
        dto.name,
        perms.map((p) => p.key),
      );
      await this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    return this.findOne(role.id, municipalityId);
  }

  async update(
    id: string,
    municipalityId: string,
    dto: UpdateRoleDto,
    actorId?: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id, municipalityId, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    assertMunicipalityAdminCanModifyRole(role, 'update');
    assertNotRenamingProtectedRole(role, dto.name);

    if (actorId) {
      await this.hierarchy.assertCanManageRole(actorId, id);
      if (dto.priority !== undefined && dto.priority !== (role as any).priority) {
        await this.hierarchy.assertCanSetPriority(actorId, dto.priority);
      }
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findFirst({
        where: {
          municipalityId,
          name: dto.name,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('Role with this name already exists');
      }
    }

    await this.prisma.role.update({
      where: { id },
      data: dto,
    });

    return this.findOne(id, municipalityId);
  }

  async setPermissions(
    id: string,
    municipalityId: string,
    permissionIds: string[],
    actorId?: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id, municipalityId, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    assertMunicipalityAdminCanModifyRole(role, 'set_permissions');

    if (actorId) {
      await this.hierarchy.assertCanManageRole(actorId, id);
    }

    const perms = permissionIds.length
      ? await this.prisma.permission.findMany({
          where: { id: { in: permissionIds } },
          select: { key: true },
        })
      : [];
    await assertCitizenRolePermissionKeys(
      role.name,
      perms.map((p) => p.key),
    );

    await this.prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    if (permissionIds.length) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }

    return this.findOne(id, municipalityId);
  }

  async remove(id: string, municipalityId: string, actorId?: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, municipalityId, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    assertMunicipalityAdminCanModifyRole(role, 'delete');

    if (actorId) {
      await this.hierarchy.assertCanManageRole(actorId, id);
    }

    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Role deleted successfully' };
  }
}
