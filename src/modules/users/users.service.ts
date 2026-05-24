import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { HierarchyResolver } from '../../core/rbac/hierarchy.resolver';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { hashPassword } from '../../core/common/utils/hash.util';
import { paginate } from '../../core/common/dto/pagination.dto';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private permissionsResolver: PermissionsResolver,
    private hierarchy: HierarchyResolver,
    private audit: AuditService,
    private realtime: RealtimeService,
  ) {}

  async findAll(requesterId: string, municipalityId: string, query: UserQueryDto) {
    // The /users administrative list has three modes:
    //   - default (staff): hide self-registered citizens AND users with the Citizen role
    //   - onlyCitizens: show ONLY users with the Citizen role (regardless of createdVia)
    //   - includeCitizens: show everyone (back-compat / power-user override)
    const where: any = { municipalityId };

    // Department-scoped access: HOD/Supervisor only see their department users
    const permissions = await this.permissionsResolver.getUserPermissions(requesterId);
    if (!permissions.includes(PERMISSIONS.USER_VIEW_ALL)) {
      // Non-admin: restrict to own department
      const requester = await this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { departmentId: true },
      });
      if (requester?.departmentId) {
        where.departmentId = requester.departmentId;
      }
    }

    if (query.search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (query.departmentId && permissions.includes(PERMISSIONS.USER_VIEW_ALL)) {
      where.departmentId = query.departmentId;
    }

    if (query.roleId) {
      where.userRoles = {
        some: { roleId: query.roleId },
      };
    }

    if (query.onlyCitizens) {
      // Citizens management tab: ONLY users whose role is Citizen.
      // This catches both self-registered (mobile) and seeded citizens.
      where.userRoles = {
        ...(where.userRoles ?? {}),
        some: { role: { name: 'Citizen' } },
      };
    } else if (query.excludeCitizens || !query.includeCitizens) {
      // Default Staff view: exclude users with only the Citizen role
      // AND exclude self-registered accounts (defence-in-depth).
      where.userRoles = {
        ...(where.userRoles ?? {}),
        some: { role: { name: { not: 'Citizen' } } },
      };
      where.createdVia = { not: 'SELF_REGISTRATION' };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          createdVia: true,
          verificationStatus: true,
          departmentId: true,
          department: {
            select: { id: true, name: true },
          },
          userRoles: {
            include: {
              role: {
                select: { id: true, name: true, priority: true },
              },
            },
          },
          createdAt: true,
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = users.map((user) => {
      const rolesWithPriority = user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        priority: (ur.role as any).priority ?? 0,
      }));
      const effectiveRank = rolesWithPriority.length
        ? Math.max(...rolesWithPriority.map((r) => r.priority ?? 0))
        : 0;
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isActive: user.isActive,
        department: user.department,
        roles: rolesWithPriority,
        effectiveRank,
        createdVia: (user as any).createdVia,
        verificationStatus: (user as any).verificationStatus,
        createdAt: user.createdAt,
      };
    });

    return paginate(data, total, query);
  }

  async findOne(id: string, municipalityId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, municipalityId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        verificationStatus: true,
        verifiedAt: true,
        createdVia: true,
        departmentId: true,
        department: {
          select: { id: true, name: true },
        },
        userRoles: {
          include: {
            role: {
              select: { id: true, name: true, priority: true },
            },
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      priority: (ur.role as any).priority ?? 0,
    }));
    const effectiveRank = roles.length
      ? Math.max(...roles.map((r) => r.priority ?? 0))
      : 0;
    return { ...user, roles, effectiveRank };
  }

  async create(
    municipalityId: string,
    dto: CreateUserDto,
    actor?: { id: string; email: string },
    req?: Request,
  ) {
    // Check for duplicate email
    const existing = await this.prisma.user.findFirst({
      where: {
        municipalityId,
        email: dto.email.toLowerCase(),
      },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hierarchy: can only seed roles strictly below my own rank
    if (actor?.id && dto.roleIds?.length) {
      for (const rid of dto.roleIds) {
        await this.hierarchy.assertCanManageRole(actor.id, rid);
      }
    }

    const passwordHash = await hashPassword(dto.password);

    // Staff accounts created by an admin are implicitly KYC-verified — the
    // admin vouches for them. Only self-registered citizens need to complete
    // the KYC flow before they can submit complaints.
    const user = await this.prisma.user.create({
      data: {
        municipalityId,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        departmentId: dto.departmentId,
        createdVia: 'ADMIN_PROVISIONED',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // Assign roles if provided
    if (dto.roleIds?.length) {
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
        })),
      });
    }

    await this.audit.logFromRequest(req, {
      actorId: actor?.id,
      actorEmail: actor?.email,
      municipalityId,
      action: AUDIT_ACTIONS.USER_CREATE,
      resourceType: 'User',
      resourceId: user.id,
      metadata: { email: user.email, roleCount: dto.roleIds?.length ?? 0 },
    });

    return this.findOne(user.id, municipalityId);
  }

  async update(
    id: string,
    municipalityId: string,
    dto: UpdateUserDto,
    actor?: { id: string; email: string },
    req?: Request,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, municipalityId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hierarchy check: can't manage someone with the same or higher rank.
    if (actor?.id) {
      await this.hierarchy.assertCanManageUser(actor.id, id);
    }

    await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    await this.audit.logFromRequest(req, {
      actorId: actor?.id,
      actorEmail: actor?.email,
      municipalityId,
      action: AUDIT_ACTIONS.USER_UPDATE,
      resourceType: 'User',
      resourceId: id,
      metadata: { fields: Object.keys(dto), email: user.email },
    });

    this.realtime.userUpdated({ id, municipalityId });

    return this.findOne(id, municipalityId);
  }

  async assignRole(
    userId: string,
    roleId: string,
    municipalityId: string,
    actor?: { id: string; email: string },
    req?: Request,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, municipalityId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, municipalityId, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // ── Constraint: self-registered citizens cannot be elevated to staff roles ──
    // Real-world rule: privileged accounts are PROVISIONED, not promoted from public sign-ups.
    // If staff need access, an admin should create a fresh staff account for them.
    if (user.createdVia === 'SELF_REGISTRATION' && role.name !== 'Citizen') {
      throw new ForbiddenException(
        'Self-registered users cannot be granted staff roles. ' +
          'Provision a new staff account instead.',
      );
    }

    // ── Constraint: positional roles (Admin, HOD) are slot-managed ──
    // They can only be granted by promoting someone into the slot, not by direct
    // role assignment. This keeps the org chart consistent (max one Admin /
    // max one HOD per department) and produces a proper audit trail.
    if ((role as any).isSystemManaged) {
      throw new ForbiddenException(
        `"${role.name}" is a positional role and cannot be granted directly. ` +
          (role.name === 'Admin'
            ? 'Use Platform → Municipalities → Transfer Admin to set the Municipality Admin slot.'
            : 'Use Departments → Set Head to fill the Head of Department slot.'),
      );
    }

    // ── Hierarchy: can only assign roles strictly below my own rank ──
    // and only manage users strictly below my own rank.
    if (actor?.id) {
      await this.hierarchy.assertCanManageUser(actor.id, userId);
      await this.hierarchy.assertCanManageRole(actor.id, roleId);
    }

    // Check if already assigned
    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: { userId, roleId },
      },
    });

    if (existing) {
      throw new ConflictException('Role already assigned to user');
    }

    await this.prisma.userRole.create({
      data: { userId, roleId },
    });

    // ── Auto-verify on staff promotion ──
    // Granting any non-Citizen role implies the actor is vouching for this
    // user as a staff member. Bring their KYC status up to VERIFIED so the
    // app doesn't gate them behind the citizen ID flow.
    if (
      role.name !== 'Citizen' &&
      (user as any).verificationStatus !== 'VERIFIED'
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });
    }

    await this.audit.logFromRequest(req, {
      actorId: actor?.id,
      actorEmail: actor?.email,
      municipalityId,
      action: AUDIT_ACTIONS.USER_ROLE_ASSIGN,
      resourceType: 'User',
      resourceId: userId,
      metadata: { roleId, roleName: role.name, targetEmail: user.email },
    });

    this.realtime.userUpdated({ id: userId, municipalityId });

    return this.findOne(userId, municipalityId);
  }

  async removeRole(
    userId: string,
    roleId: string,
    municipalityId: string,
    actor?: { id: string; email: string },
    req?: Request,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, municipalityId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findFirst({
      where: { id: roleId },
      select: { name: true, isSystemManaged: true } as any,
    });

    if ((role as any)?.isSystemManaged) {
      throw new ForbiddenException(
        `"${(role as any).name}" is a positional role and cannot be removed directly. ` +
          (((role as any).name === 'Admin')
            ? 'Use Platform → Municipalities → Transfer Admin instead.'
            : 'Use Departments → Vacate Head instead.'),
      );
    }

    // Hierarchy enforcement
    if (actor?.id) {
      await this.hierarchy.assertCanManageUser(actor.id, userId);
      await this.hierarchy.assertCanManageRole(actor.id, roleId);
    }

    await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });

    await this.audit.logFromRequest(req, {
      actorId: actor?.id,
      actorEmail: actor?.email,
      municipalityId,
      action: AUDIT_ACTIONS.USER_ROLE_REMOVE,
      resourceType: 'User',
      resourceId: userId,
      metadata: { roleId, roleName: role?.name, targetEmail: user.email },
    });

    this.realtime.userUpdated({ id: userId, municipalityId });

    return this.findOne(userId, municipalityId);
  }
}
