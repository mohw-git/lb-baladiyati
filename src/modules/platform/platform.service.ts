import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/prisma/prisma.service';
import { hashPassword } from '../../core/common/utils/hash.util';
import { DEFAULT_ROLES, PERMISSION_SEED_DATA } from '../../core/rbac/permissions.constants';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';
import { JwtPayload } from '../../core/auth/types/jwt-payload';
import { StorageService } from '../../core/storage/storage.service';

@Injectable()
export class PlatformService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
    private storage: StorageService,
  ) {}

  // ============================================================
  // MUNICIPALITIES
  // ============================================================

  async listMunicipalities(includeInactive = false) {
    const munis = await this.prisma.municipality.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        admin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            users: true,
            departments: true,
            complaints: true,
          },
        },
      },
    });
    return { data: munis };
  }

  async getMunicipality(id: string) {
    const muni = await this.prisma.municipality.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, departments: true, complaints: true, newsPosts: true },
        },
      },
    });
    if (!muni) throw new NotFoundException('Municipality not found');
    return muni;
  }

  /**
   * Create a new municipality and bootstrap it with:
   *  - All standard roles (Citizen, Field Worker, Supervisor, HOD, Verifier, Admin)
   *  - Default departments (6 standard ones)
   *  - First admin user
   */
  async createMunicipality(
    dto: CreateMunicipalityDto,
    actorId: string,
    actorEmail: string,
  ) {
    const existing = await this.prisma.municipality.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Municipality with code "${dto.code}" already exists`);
    }

    const adminEmailExists = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (adminEmailExists) {
      throw new ConflictException(`A user with email "${dto.adminEmail}" already exists`);
    }

    const passwordHash = await hashPassword(dto.adminPassword);

    const result = await this.prisma.$transaction(async (tx) => {
      const muni = await tx.municipality.create({
        data: {
          name: dto.name,
          nameAr: dto.nameAr,
          nameFr: dto.nameFr,
          code: dto.code,
          isActive: true,
        },
      });

      // 1. Roles + permissions
      const allPermissions = await tx.permission.findMany();
      // Backfill permissions if missing (idempotent)
      if (allPermissions.length < PERMISSION_SEED_DATA.length) {
        for (const p of PERMISSION_SEED_DATA) {
          await tx.permission.upsert({
            where: { key: p.key },
            update: { name: p.name, module: p.module },
            create: p,
          });
        }
      }
      const permissions = await tx.permission.findMany();
      const permsByKey = new Map(permissions.map((p) => [p.key, p]));

      const createdRoles: Record<string, string> = {};
      for (const [, roleConfig] of Object.entries(DEFAULT_ROLES)) {
        const role = await tx.role.create({
          data: {
            municipalityId: muni.id,
            name: roleConfig.name,
            description: roleConfig.description,
          },
        });
        createdRoles[roleConfig.name] = role.id;
        for (const permKey of roleConfig.permissions) {
          const perm = permsByKey.get(permKey);
          if (perm) {
            await tx.rolePermission.create({
              data: { roleId: role.id, permissionId: perm.id },
            });
          }
        }
      }

      // 2. Default departments
      const defaultDepartments = [
        { name: 'Roads & Infrastructure', description: 'Roads, bridges, sidewalks' },
        { name: 'Public Works', description: 'Street lights, traffic signs, public facilities' },
        { name: 'Sanitation', description: 'Garbage collection, sewage, public cleaning' },
        { name: 'Water Authority', description: 'Water supply, pipes, drainage' },
        { name: 'Parks & Recreation', description: 'Parks, green spaces, playgrounds' },
        { name: 'Public Safety', description: 'Safety hazards, emergency issues' },
      ];
      for (const dept of defaultDepartments) {
        await tx.department.create({
          data: { municipalityId: muni.id, ...dept },
        });
      }

      // 3. First admin user
      const adminUser = await tx.user.create({
        data: {
          municipalityId: muni.id,
          email: dto.adminEmail,
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          isActive: true,
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          createdVia: 'PLATFORM_PROVISIONED',
        },
      });
      await tx.userRole.create({
        data: { userId: adminUser.id, roleId: createdRoles['Admin'] },
      });

      return { muni, adminUser };
    });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId: result.muni.id,
      action: 'platform.municipality.create',
      resourceType: 'Municipality',
      resourceId: result.muni.id,
      metadata: {
        name: result.muni.name,
        code: result.muni.code,
        adminEmail: dto.adminEmail,
      },
    });

    return {
      municipality: {
        id: result.muni.id,
        name: result.muni.name,
        code: result.muni.code,
        isActive: result.muni.isActive,
      },
      admin: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        firstName: result.adminUser.firstName,
        lastName: result.adminUser.lastName,
      },
    };
  }

  async updateMunicipality(
    id: string,
    dto: UpdateMunicipalityDto,
    actorId: string,
    actorEmail: string,
  ) {
    const existing = await this.prisma.municipality.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Municipality not found');

    const updated = await this.prisma.municipality.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId: id,
      action: 'platform.municipality.update',
      resourceType: 'Municipality',
      resourceId: id,
      metadata: { changes: dto, before: { name: existing.name, isActive: existing.isActive } },
    });

    return updated;
  }

  // ============================================================
  // CROSS-TENANT USERS
  // ============================================================

  async listAllUsers(opts: {
    page?: number;
    limit?: number;
    search?: string;
    municipalityId?: string;
    isActive?: boolean;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, opts.limit ?? 50);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.municipalityId) where.municipalityId = opts.municipalityId;
    if (typeof opts.isActive === 'boolean') where.isActive = opts.isActive;
    if (opts.search) {
      where.OR = [
        { email: { contains: opts.search, mode: 'insensitive' } },
        { firstName: { contains: opts.search, mode: 'insensitive' } },
        { lastName: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          isSuperAdmin: true,
          verificationStatus: true,
          createdAt: true,
          municipality: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true } },
          userRoles: { select: { role: { select: { name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        roles: u.userRoles.map((ur) => ur.role.name),
        userRoles: undefined,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async setUserActive(
    id: string,
    isActive: boolean,
    actorId: string,
    actorEmail: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });

    if (!isActive) {
      // revoke all refresh tokens
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId: user.municipalityId,
      action: isActive ? 'platform.user.activate' : 'platform.user.deactivate',
      resourceType: 'User',
      resourceId: id,
      metadata: { email: user.email },
    });

    return { id: updated.id, isActive: updated.isActive };
  }

  // ============================================================
  // STATS
  // ============================================================

  async getPlatformStats() {
    const [
      totalMunicipalities,
      activeMunicipalities,
      totalUsers,
      activeUsers,
      totalComplaints,
      complaintsByStatus,
      kycPending,
      recentMunicipalities,
    ] = await Promise.all([
      this.prisma.municipality.count(),
      this.prisma.municipality.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.complaint.count(),
      this.prisma.complaint.groupBy({ by: ['status'], _count: true }),
      this.prisma.kycSubmission.count({ where: { status: 'PENDING' } }),
      this.prisma.municipality.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, code: true, isActive: true, createdAt: true },
      }),
    ]);

    // Per-municipality complaint counts
    const perMuni = await this.prisma.complaint.groupBy({
      by: ['municipalityId'],
      _count: true,
    });
    const muniMap = new Map(
      (await this.prisma.municipality.findMany({ select: { id: true, name: true } })).map((m) => [
        m.id,
        m.name,
      ]),
    );

    // ── Time-series: complaints per day (last 30 days) ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentComplaints = await this.prisma.complaint.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, municipalityId: true, status: true },
    });

    // Build daily counts
    const dailyMap = new Map<string, number>();
    const dailyByMuni = new Map<string, Map<string, number>>();
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const c of recentComplaints) {
      const day = c.createdAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
      const muniId = c.municipalityId ?? 'unknown';
      if (!dailyByMuni.has(muniId)) dailyByMuni.set(muniId, new Map());
      const muniDay = dailyByMuni.get(muniId)!;
      muniDay.set(day, (muniDay.get(day) ?? 0) + 1);
    }

    const complaintsPerDay = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Per-municipality daily series (top 5 by total volume)
    const topMunis = perMuni
      .sort((a, b) => b._count - a._count)
      .slice(0, 5)
      .map((p) => p.municipalityId ?? 'unknown');

    const complaintsPerDayByMunicipality = complaintsPerDay.map((day) => {
      const entry: Record<string, any> = { date: day.date };
      for (const muniId of topMunis) {
        entry[muniMap.get(muniId) ?? muniId] =
          dailyByMuni.get(muniId)?.get(day.date) ?? 0;
      }
      return entry;
    });

    // ── Resolution rate (completed+closed / total) ──
    const completed = complaintsByStatus
      .filter((s) => s.status === 'COMPLETED' || s.status === 'CLOSED')
      .reduce((acc, s) => acc + s._count, 0);
    const resolutionRate = totalComplaints > 0 ? Math.round((completed / totalComplaints) * 100) : 0;

    // ── SLA: overdue complaints ──
    const overdue = await this.prisma.complaint.count({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED'] },
      },
    });

    return {
      municipalities: { total: totalMunicipalities, active: activeMunicipalities },
      users: { total: totalUsers, active: activeUsers },
      complaints: {
        total: totalComplaints,
        byStatus: complaintsByStatus.map((c) => ({ status: c.status, count: c._count })),
        byMunicipality: perMuni.map((p) => ({
          municipalityId: p.municipalityId,
          municipalityName: muniMap.get(p.municipalityId ?? '') ?? 'Unknown',
          count: p._count,
        })),
        resolutionRate,
        overdue,
      },
      kyc: { pending: kycPending },
      recentMunicipalities,
      charts: {
        complaintsPerDay,
        complaintsPerDayByMunicipality,
        municipalityNames: topMunis.map((id) => muniMap.get(id) ?? id),
      },
    };
  }

  // ============================================================
  // IMPERSONATION
  // ============================================================

  /**
   * Issue a short-lived (15min) access token impersonating the target user.
   * No refresh token. Audit logged. Cannot impersonate other super admins.
   */
  async impersonate(
    targetUserId: string,
    actorId: string,
    actorEmail: string,
    ip?: string,
    ua?: string,
  ) {
    if (targetUserId === actorId) {
      throw new BadRequestException('Cannot impersonate yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        municipalityId: true,
        isActive: true,
        isSuperAdmin: true,
      },
    });

    if (!target) throw new NotFoundException('Target user not found');
    if (!target.isActive) throw new BadRequestException('Target user is inactive');
    if (target.isSuperAdmin) {
      throw new BadRequestException('Cannot impersonate another super admin');
    }

    const payload: JwtPayload = {
      sub: target.id,
      email: target.email,
      municipalityId: target.municipalityId ?? '',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId: target.municipalityId,
      action: 'platform.impersonate',
      resourceType: 'User',
      resourceId: target.id,
      ipAddress: ip,
      userAgent: ua,
      metadata: { targetEmail: target.email },
    });

    return {
      accessToken,
      expiresIn: 15 * 60,
      target: { id: target.id, email: target.email, municipalityId: target.municipalityId },
    };
  }

  // ============================================================
  // ADMINISTRATIVE: reset password / 2FA / delete / transfer admin
  // ============================================================

  /**
   * Force-reset a user's password. Sets `mustChangePassword=true` so they have
   * to change it on next login. Also revokes every refresh token they have so
   * they're kicked out of all devices.
   */
  async resetUserPassword(
    targetId: string,
    newPassword: string,
    actorId: string,
    actorEmail: string,
  ) {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');
    // Prevent locking out other super admins
    if (target.isSuperAdmin && target.id !== actorId) {
      throw new BadRequestException(
        'Cannot reset another super admin\'s password from here',
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: targetId },
      data: { passwordHash, mustChangePassword: true },
    });
    // Force logout from all devices
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId: target.municipalityId,
      action: AUDIT_ACTIONS.PLATFORM_USER_RESET_PASSWORD,
      resourceType: 'User',
      resourceId: targetId,
      metadata: { targetEmail: target.email },
    });

    return { ok: true };
  }

  /**
   * Force-disable 2FA for a user (e.g. they lost their authenticator).
   * Clears the secret entirely. They'll have to re-enroll if they want it back.
   */
  async resetUser2FA(targetId: string, actorId: string, actorEmail: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: targetId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId: target.municipalityId,
      action: AUDIT_ACTIONS.PLATFORM_USER_RESET_2FA,
      resourceType: 'User',
      resourceId: targetId,
      metadata: { targetEmail: target.email },
    });

    return { ok: true };
  }

  /**
   * Force-logout a user from every device (revoke all refresh tokens).
   */
  async forceLogout(targetId: string, actorId: string, actorEmail: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    const result = await this.prisma.refreshToken.updateMany({
      where: { userId: targetId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId: target.municipalityId,
      action: AUDIT_ACTIONS.PLATFORM_USER_FORCE_LOGOUT,
      resourceType: 'User',
      resourceId: targetId,
      metadata: { targetEmail: target.email, sessionsRevoked: result.count },
    });

    return { ok: true, sessionsRevoked: result.count };
  }

  /**
   * Permanently delete a user (cascades to user_roles, sessions, etc.).
   * Refuses if the user has authored data (complaints, news) — in that case
   * we'd lose attribution. Suggests deactivation instead.
   */
  async deleteUser(targetId: string, actorId: string, actorEmail: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: {
        _count: {
          select: {
            complaintsCreated: true,
            newsPosts: true,
          },
        },
      },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.isSuperAdmin) {
      throw new BadRequestException('Super admin accounts cannot be deleted from here');
    }
    if (target.id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    if (target._count.complaintsCreated > 0 || target._count.newsPosts > 0) {
      throw new BadRequestException(
        `User has ${target._count.complaintsCreated} complaints and ` +
          `${target._count.newsPosts} news posts. Deactivate instead to preserve history.`,
      );
    }

    // Clean up child rows that don't have ON DELETE CASCADE
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: targetId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: targetId } }),
      this.prisma.user.delete({ where: { id: targetId } }),
    ]);

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId: target.municipalityId,
      action: AUDIT_ACTIONS.PLATFORM_USER_DELETE,
      resourceType: 'User',
      resourceId: targetId,
      metadata: { targetEmail: target.email },
    });

    return { ok: true };
  }

  /**
   * Transfer (or grant) the Admin role on a municipality to a different user.
   * Optionally removes the Admin role from the previous admin.
   */
  async transferMunicipalityAdmin(
    municipalityId: string,
    target: { newAdminUserId?: string; newAdminEmail?: string },
    actorId: string,
    actorEmail: string,
    options?: { revokePrevious?: boolean },
  ) {
    const muni = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
    });
    if (!muni) throw new NotFoundException('Municipality not found');

    if (!target.newAdminUserId && !target.newAdminEmail) {
      throw new BadRequestException(
        'Provide either newAdminUserId or newAdminEmail',
      );
    }

    const newAdmin = await this.prisma.user.findFirst({
      where: target.newAdminUserId
        ? { id: target.newAdminUserId, municipalityId }
        : {
            email: target.newAdminEmail!.trim().toLowerCase(),
            municipalityId,
          },
    });
    if (!newAdmin) {
      throw new NotFoundException(
        target.newAdminEmail
          ? `No user with email "${target.newAdminEmail}" found in this municipality. ` +
              'The user must already be provisioned as a staff member of this municipality before being promoted.'
          : 'New admin user not found in this municipality',
      );
    }
    const newAdminUserId = newAdmin.id;
    if (newAdmin.createdVia === 'SELF_REGISTRATION') {
      throw new BadRequestException(
        'Cannot promote a self-registered (citizen) account to Admin. ' +
          'Provision a new staff account instead.',
      );
    }
    if (!newAdmin.isActive) {
      throw new BadRequestException('Target user is inactive');
    }

    const adminRole = await this.prisma.role.findFirst({
      where: { municipalityId, name: 'Admin', deletedAt: null },
    });
    if (!adminRole) {
      throw new NotFoundException('Admin role not found for this municipality');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Read current slot holder
      const muniNow = await tx.municipality.findUnique({
        where: { id: municipalityId },
        select: { adminUserId: true },
      });
      const previousAdminId = muniNow?.adminUserId ?? null;

      // 2. Move the slot to the new user
      await tx.municipality.update({
        where: { id: municipalityId },
        data: { adminUserId: newAdminUserId },
      });

      // 3. Grant Admin role to the new user (idempotent)
      const exists = await tx.userRole.findUnique({
        where: { userId_roleId: { userId: newAdminUserId, roleId: adminRole.id } },
      });
      if (!exists) {
        await tx.userRole.create({
          data: { userId: newAdminUserId, roleId: adminRole.id },
        });
      }

      // 4. Revoke from previous holder (or, if requested, from everyone else)
      if (options?.revokePrevious) {
        await tx.userRole.deleteMany({
          where: {
            roleId: adminRole.id,
            userId: { not: newAdminUserId },
          },
        });
      } else if (previousAdminId && previousAdminId !== newAdminUserId) {
        await tx.userRole.deleteMany({
          where: { roleId: adminRole.id, userId: previousAdminId },
        });
      }
    });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId,
      action: AUDIT_ACTIONS.PLATFORM_TRANSFER_ADMIN,
      resourceType: 'Municipality',
      resourceId: municipalityId,
      metadata: {
        newAdminId: newAdminUserId,
        newAdminEmail: newAdmin.email,
        revokePrevious: !!options?.revokePrevious,
      },
    });

    return { ok: true, newAdminEmail: newAdmin.email };
  }

  /**
   * Clear the Admin slot on a municipality. Removes the Admin role from the
   * current holder and leaves the slot vacant (UI will warn).
   */
  async vacateMunicipalityAdmin(
    municipalityId: string,
    actorId: string,
    actorEmail: string,
  ) {
    const muni = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { adminUserId: true, name: true },
    });
    if (!muni) throw new NotFoundException('Municipality not found');
    if (!muni.adminUserId) {
      return { ok: true, alreadyVacant: true };
    }
    const adminRole = await this.prisma.role.findFirst({
      where: { municipalityId, name: 'Admin', deletedAt: null },
    });
    await this.prisma.$transaction([
      this.prisma.municipality.update({
        where: { id: municipalityId },
        data: { adminUserId: null },
      }),
      ...(adminRole
        ? [
            this.prisma.userRole.deleteMany({
              where: { roleId: adminRole.id, userId: muni.adminUserId },
            }),
          ]
        : []),
    ]);
    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId,
      action: AUDIT_ACTIONS.PLATFORM_TRANSFER_ADMIN,
      resourceType: 'Municipality',
      resourceId: municipalityId,
      metadata: { vacated: true, previousAdminId: muni.adminUserId },
    });
    return { ok: true };
  }

  // ============================================================
  // PLATFORM SETTINGS (maintenance mode + future feature flags)
  // ============================================================

  static readonly KEY_MAINTENANCE_MODE = 'maintenance.enabled';
  static readonly KEY_MAINTENANCE_MESSAGE = 'maintenance.message';
  static readonly KEY_REQUIRE_2FA_STAFF = 'auth.require_2fa_staff';
  /**
   * Platform-wide flag. When true, /auth/login refuses to issue access
   * tokens to a user whose email has not been verified yet (returns a
   * structured 403 with `code: 'EMAIL_NOT_VERIFIED'` so the client can
   * show a Resend-Verification UI). When false (default), unverified
   * users are still let in but the dashboard shows a persistent banner.
   */
  static readonly KEY_REQUIRE_EMAIL_VERIFICATION = 'auth.require_email_verification';
  /** When true, citizens without verified email/KYC may submit complaints (forced LOW priority, risk flags). */
  static readonly KEY_ALLOW_UNVERIFIED_CITIZEN_COMPLAINTS =
    'complaints.allow_unverified_citizen_complaints';

  async listSettings() {
    return this.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async getSetting(key: string): Promise<string | null> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async setSetting(
    key: string,
    value: string,
    description: string | undefined,
    actorId: string,
    actorEmail: string,
  ) {
    const updated = await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value, description, updatedById: actorId },
      update: { value, description, updatedById: actorId },
    });
    await this.audit.log({
      actorId,
      actorEmail,
      action: AUDIT_ACTIONS.PLATFORM_SETTING_UPDATE,
      resourceType: 'PlatformSetting',
      resourceId: key,
      metadata: { value },
    });
    return updated;
  }

  async getMaintenanceMode() {
    const [enabled, message] = await Promise.all([
      this.getSetting(PlatformService.KEY_MAINTENANCE_MODE),
      this.getSetting(PlatformService.KEY_MAINTENANCE_MESSAGE),
    ]);
    return {
      enabled: enabled === 'true',
      message: message ?? '',
    };
  }

  async setMaintenanceMode(
    enabled: boolean,
    message: string | undefined,
    actorId: string,
    actorEmail: string,
  ) {
    await this.setSetting(
      PlatformService.KEY_MAINTENANCE_MODE,
      enabled ? 'true' : 'false',
      'Maintenance mode flag — when true, non-super-admin requests get HTTP 503',
      actorId,
      actorEmail,
    );
    if (message !== undefined) {
      await this.setSetting(
        PlatformService.KEY_MAINTENANCE_MESSAGE,
        message,
        'Message displayed to users while maintenance mode is on',
        actorId,
        actorEmail,
      );
    }
    await this.audit.log({
      actorId,
      actorEmail,
      action: enabled
        ? AUDIT_ACTIONS.PLATFORM_MAINTENANCE_ON
        : AUDIT_ACTIONS.PLATFORM_MAINTENANCE_OFF,
      metadata: { message },
    });
    return this.getMaintenanceMode();
  }

  /**
   * Returns the current "require 2FA for staff" platform-wide flag.
   * When true, any non-citizen account that has not enabled 2FA will be
   * forced into the 2FA setup flow on login before they can use the app.
   */
  async getRequireTwoFactorForStaff(): Promise<boolean> {
    const v = await this.getSetting(PlatformService.KEY_REQUIRE_2FA_STAFF);
    return v === 'true';
  }

  async setRequireTwoFactorForStaff(
    enabled: boolean,
    actorId: string,
    actorEmail: string,
  ) {
    await this.setSetting(
      PlatformService.KEY_REQUIRE_2FA_STAFF,
      enabled ? 'true' : 'false',
      'When true, all staff (non-citizen) accounts must enroll in 2FA before they can use the app',
      actorId,
      actorEmail,
    );
    return { enabled };
  }

  /**
   * Returns the current "require email verification" flag. When true,
   * /auth/login refuses to issue access tokens until the user's email is
   * verified. When false (default) unverified users can sign in but the
   * dashboard surfaces a persistent banner asking them to verify.
   */
  async getRequireEmailVerification(): Promise<boolean> {
    const v = await this.getSetting(PlatformService.KEY_REQUIRE_EMAIL_VERIFICATION);
    return v === 'true';
  }

  async setRequireEmailVerification(
    enabled: boolean,
    actorId: string,
    actorEmail: string,
  ) {
    await this.setSetting(
      PlatformService.KEY_REQUIRE_EMAIL_VERIFICATION,
      enabled ? 'true' : 'false',
      'When true, /auth/login blocks unverified email accounts and the client must complete email verification before being issued an access token.',
      actorId,
      actorEmail,
    );
    return { enabled };
  }

  async getAllowUnverifiedCitizenComplaints(): Promise<boolean> {
    const v = await this.getSetting(
      PlatformService.KEY_ALLOW_UNVERIFIED_CITIZEN_COMPLAINTS,
    );
    return v === 'true';
  }

  async setAllowUnverifiedCitizenComplaints(
    enabled: boolean,
    actorId: string,
    actorEmail: string,
  ) {
    await this.setSetting(
      PlatformService.KEY_ALLOW_UNVERIFIED_CITIZEN_COMPLAINTS,
      enabled ? 'true' : 'false',
      'When true, citizens without verified email or KYC may submit complaints. Such complaints are forced to LOW priority and marked internally for staff review.',
      actorId,
      actorEmail,
    );
    return { enabled };
  }

  // ============================================================
  // PLATFORM BRANDING
  // ============================================================

  async getPlatformBranding() {
    const branding = await this.prisma.platformBranding.findUnique({
      where: { id: 'default' },
    });
    // Return with safe defaults if not yet configured
    return (
      branding ?? {
        id: 'default',
        logoUrl: null,
        bannerImageUrl: null,
        bannerOverlayColor: '#0c1a2e',
        bannerOverlayOpacity: 0.65,
        platformName: 'Baladi',
        platformNameAr: 'بلدي',
        platformNameFr: 'Baladi',
        platformDescription: null,
        platformDescriptionAr: null,
        platformDescriptionFr: null,
        operatorName: null,
        operatorNameAr: null,
        operatorNameFr: null,
        supportEmail: null,
        supportPhone: null,
        supportWhatsApp: null,
        officeAddress: null,
        officeAddressAr: null,
        officeAddressFr: null,
        openingHours: null,
        openingHoursAr: null,
        openingHoursFr: null,
        appStoreUrl: null,
        googlePlayUrl: null,
        apkUrl: null,
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Upload an image used in platform branding (logo or banner) and persist
   * the URL on the singleton record.
   */
  async uploadPlatformBrandingImage(
    field: 'logoUrl' | 'bannerImageUrl',
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Branding image must be an image');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Branding image must be smaller than 5MB');
    }
    const folder = field === 'logoUrl' ? 'platform/logo' : 'platform/banner';
    const url = await this.storage.saveFile(file, folder);
    return this.updatePlatformBranding({ [field]: url } as any);
  }

  async updatePlatformBranding(
    data: Partial<{
      logoUrl: string;
      bannerImageUrl: string;
      bannerOverlayColor: string;
      bannerOverlayOpacity: number;
      platformName: string;
      platformNameAr: string;
      platformNameFr: string;
      platformDescription: string;
      platformDescriptionAr: string;
      platformDescriptionFr: string;
      operatorName: string;
      operatorNameAr: string;
      operatorNameFr: string;
      supportEmail: string;
      supportPhone: string;
      supportWhatsApp: string;
      officeAddress: string;
      officeAddressAr: string;
      officeAddressFr: string;
      openingHours: string;
      openingHoursAr: string;
      openingHoursFr: string;
      appStoreUrl: string;
      googlePlayUrl: string;
      apkUrl: string;
    }>,
  ) {
    return this.prisma.platformBranding.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });
  }
}
