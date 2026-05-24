import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { hashPassword, comparePassword } from '../../core/common/utils/hash.util';
import { StorageService } from '../../core/storage/storage.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from '../../core/auth/types/jwt-payload';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';
import { MailService, redactEmail } from '../../core/mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private permissionsResolver: PermissionsResolver,
    private storageService: StorageService,
    private audit: AuditService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Self-registered accounts and Citizen-only role holders. */
  private isCitizenAccount(user: {
    createdVia: string;
    userRoles: { role: { name: string } }[];
  }): boolean {
    if (user.createdVia === 'SELF_REGISTRATION') return true;
    const roleNames = user.userRoles
      .map((ur) => ur.role?.name)
      .filter((n): n is string => !!n);
    return roleNames.length > 0 && roleNames.every((n) => n === 'Citizen');
  }

  /**
   * Remove staff-only metadata from profile/session payloads for citizens.
   * Clients apply citizen permission keys locally for navigation guards.
   */
  private sanitizeProfileForCitizen<T extends Record<string, unknown>>(profile: T): T {
    const {
      roles: _roles,
      rolesDetailed: _rolesDetailed,
      department: _department,
      permissions: _permissions,
      effectiveRank: _effectiveRank,
      isSuperAdmin: _isSuperAdmin,
      mustEnrollTwoFactor: _mustEnrollTwoFactor,
      ...rest
    } = profile;
    return {
      ...rest,
      accountType: 'CITIZEN',
      roles: [],
      permissions: [],
      department: null,
      isSuperAdmin: false,
      mustEnrollTwoFactor: false,
    } as unknown as T;
  }

  async register(dto: RegisterDto, req?: Request) {
    // Find municipality by code
    const municipality = await this.prisma.municipality.findUnique({
      where: { code: dto.municipalityCode.toUpperCase() },
    });

    if (!municipality) {
      throw new NotFoundException('Municipality not found');
    }

    if (!municipality.isActive) {
      throw new NotFoundException('Municipality is not active');
    }

    // Check if email already exists ANYWHERE (global uniqueness for security)
    // This prevents ambiguous logins across municipalities
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
      },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(dto.password);

    // Create user — flagged as SELF_REGISTRATION so they can never be elevated
    // to staff roles via the admin UI. Real-world rule: privileged accounts are
    // ALWAYS provisioned by an existing admin/operator, not promoted from
    // public sign-ups.
    const user = await this.prisma.user.create({
      data: {
        municipalityId: municipality.id,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        createdVia: 'SELF_REGISTRATION',
      },
    });

    // Find and assign Citizen role
    const citizenRole = await this.prisma.role.findFirst({
      where: {
        municipalityId: municipality.id,
        name: 'Citizen',
        deletedAt: null,
      },
    });

    if (citizenRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: citizenRole.id,
        },
      });
    }

    // Generate tokens and persist refresh token
    const { accessToken, refreshToken } = await this.generateAndStoreTokens(user);

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: municipality.id,
      action: AUDIT_ACTIONS.AUTH_REGISTER,
      resourceType: 'User',
      resourceId: user.id,
      metadata: { email: user.email, municipalityCode: municipality.code },
    });

    // Fire-and-forget verification email. Don't block registration on
    // email delivery — MailService swallows provider errors.
    this.sendEmailVerification(user.email, req).catch(() => undefined);

    return {
      user: await this.getProfile(user.id),
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto, req?: Request) {
    // Find ALL users with this email - if more than one exists (legacy data),
    // we have an ambiguity problem and must reject the login for security
    const users = await this.prisma.user.findMany({
      where: {
        email: dto.email.toLowerCase(),
      },
    });

    if (users.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (users.length > 1) {
      // Multiple accounts share this email across municipalities (legacy/seed data).
      // Reject login to prevent cross-tenant token issuance.
      throw new UnauthorizedException(
        'Account ambiguity detected. Please contact support to resolve duplicate accounts.',
      );
    }

    const user = users[0];

    if (!user.isActive) {
      await this.audit.logFromRequest(req, {
        actorEmail: dto.email.toLowerCase(),
        municipalityId: user.municipalityId,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        metadata: { reason: 'inactive_account', email: dto.email.toLowerCase() },
      });
      throw new UnauthorizedException('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await comparePassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.audit.logFromRequest(req, {
        actorId: user.id,
        actorEmail: user.email,
        municipalityId: user.municipalityId,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        metadata: { reason: 'wrong_password', email: dto.email.toLowerCase() },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // ── Email verification gate ───────────────────────────────────
    // Only enforced when the Super Admin has flipped the platform
    // setting `auth.require_email_verification = true`. We throw a
    // structured 403 with `code: EMAIL_NOT_VERIFIED` so the frontend
    // can render the dedicated "verify your email" UI (banner +
    // Resend button) without parsing free-form messages. The email is
    // included so the client can prefill the Resend form even if the
    // user used a different value on the next attempt.
    if (!(user as any).emailVerifiedAt) {
      const requireSetting = await this.prisma.platformSetting.findUnique({
        where: { key: 'auth.require_email_verification' },
      });
      if (requireSetting?.value === 'true') {
        const isCitizen = (user as any).createdVia === 'SELF_REGISTRATION';
        let allowLimitedCitizenAccess = false;
        if (isCitizen) {
          const allowComplaints = await this.prisma.platformSetting.findUnique({
            where: { key: 'complaints.allow_unverified_citizen_complaints' },
          });
          allowLimitedCitizenAccess = allowComplaints?.value === 'true';
        }

        if (!allowLimitedCitizenAccess) {
          // Best-effort: kick off a fresh verification email so the user
          // has something actionable in their inbox right away. Honours
          // the per-user 3-tokens-per-15-min throttle in
          // sendEmailVerification() so this can't be weaponised by repeated
          // login attempts.
          await this.sendEmailVerification(user.email, req).catch(() => undefined);
          await this.audit.logFromRequest(req, {
            actorId: user.id,
            actorEmail: user.email,
            municipalityId: user.municipalityId,
            action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
            metadata: {
              reason: 'email_not_verified',
              email: dto.email.toLowerCase(),
            },
          });
          throw new ForbiddenException({
            code: 'EMAIL_NOT_VERIFIED',
            message:
              'Your email address is not verified. Please check your inbox for the verification link.',
            email: user.email,
          });
        }
      }
    }

    // 2FA check — if enabled, return a short-lived challenge token instead
    // of full tokens. The `method` lets the client decide whether to ask
    // the user for a TOTP code (Google Authenticator) or an email OTP.
    if (user.twoFactorEnabled) {
      const method = (user as any).twoFactorMethod ?? 'TOTP';
      const challengeToken = this.jwtService.sign(
        { sub: user.id, email: user.email, twoFactor: 'challenge', method },
        { expiresIn: '5m' },
      );

      // For email-method 2FA, dispatch the OTP synchronously so the
      // client can immediately ask the user to check their inbox. We
      // never throw here on email-send failure — the user can request
      // a resend via /auth/2fa/email/resend.
      if (method === 'EMAIL') {
        try {
          await this.issueEmailOtpForLogin(
            {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              locale: (user as any).locale,
            },
            req,
          );
        } catch (err) {
          // BadRequestException from rate-limit bubbles up, anything
          // else gets swallowed so the challenge still succeeds.
          if (err instanceof BadRequestException) throw err;
        }
      }

      return {
        twoFactorRequired: true,
        twoFactorMethod: method,
        challengeToken,
      };
    }

    const roles = await this.permissionsResolver.getUserRoleNames(user.id);

    const { accessToken, refreshToken } = await this.generateAndStoreTokens(user);

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      metadata: { roles },
    });

    return {
      user: await this.getProfile(user.id),
      accessToken,
      refreshToken,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        verificationStatus: true,
        verifiedAt: true,
        emailVerifiedAt: true,
        isActive: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        mustChangePassword: true,
        createdVia: true,
        locale: true,
        municipalityId: true,
        municipality: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            nameFr: true,
            code: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            nameFr: true,
          },
        },
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                nameAr: true,
                nameFr: true,
                priority: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get fresh permissions from database (super admins get all)
    const permissions = await this.permissionsResolver.getUserPermissions(userId);
    const isSuperAdmin = await this.permissionsResolver.isSuperAdmin(userId);
    // Effective rank for hierarchy-based UI gating (Discord-style).
    const rolePriorities = user.userRoles
      .map((ur: any) => ur.role?.priority ?? 0);
    const effectiveRank = isSuperAdmin
      ? Number.MAX_SAFE_INTEGER
      : rolePriorities.length
        ? Math.max(...rolePriorities)
        : 0;

    // Re-evaluate the platform-wide require-2FA-for-staff flag on every
    // profile fetch so the UI can react without forcing a re-login when the
    // Super Admin toggles it.
    const isStaff = (user as any).createdVia !== 'SELF_REGISTRATION';
    const twoFactorEnabled = (user as any).twoFactorEnabled ?? false;
    const twoFactorMethod = twoFactorEnabled
      ? ((user as any).twoFactorMethod as 'TOTP' | 'EMAIL' | null) ?? 'TOTP'
      : null;
    let mustEnrollTwoFactor = false;
    if (isStaff && !twoFactorEnabled) {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: 'auth.require_2fa_staff' },
      });
      mustEnrollTwoFactor = setting?.value === 'true';
    }

    const profile = {
      id: user.id,
      createdVia: (user as any).createdVia,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      verificationStatus: user.verificationStatus,
      verifiedAt: user.verifiedAt,
      // Email-address verification (separate from KYC `verifiedAt`).
      emailVerifiedAt: (user as any).emailVerifiedAt ?? null,
      emailVerified: !!(user as any).emailVerifiedAt,
      isActive: user.isActive,
      isSuperAdmin,
      twoFactorEnabled,
      twoFactorMethod,
      mustChangePassword: (user as any).mustChangePassword ?? false,
      mustEnrollTwoFactor,
      locale: (user as any).locale ?? 'EN',
      municipalityId: user.municipalityId,
      municipality: user.municipality,
      department: user.department,
      roles: isSuperAdmin
        ? ['Super Admin', ...user.userRoles.map((ur) => ur.role.name)]
        : user.userRoles.map((ur) => ur.role.name),
      // Detailed roles preserve the Ar/Fr names for the client-side language switcher.
      rolesDetailed: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        nameAr: (ur.role as any).nameAr ?? null,
        nameFr: (ur.role as any).nameFr ?? null,
      })),
      permissions,
      effectiveRank,
      accountType: 'STAFF' as const,
    };

    if (this.isCitizenAccount(user as any)) {
      const allowRow = await this.prisma.platformSetting.findUnique({
        where: { key: 'complaints.allow_unverified_citizen_complaints' },
      });
      return this.sanitizeProfileForCitizen({
        ...profile,
        allowUnverifiedCitizenComplaints: allowRow?.value === 'true',
      });
    }

    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.locale && { locale: dto.locale }),
      },
    });
    // Return the full profile shape (same as `getProfile`) so the frontend
    // can safely overwrite `useAuthStore.user` without losing isSuperAdmin,
    // twoFactorEnabled, effectiveRank, etc. Otherwise the language switcher
    // would drop super admins into the tenant view.
    return this.getProfile(userId);
  }

  async refreshTokens(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);

    // Look up the stored token
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    // If the token was already revoked, this is a replay attack - revoke entire family
    if (storedToken.isRevoked) {
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('Refresh token reuse detected - all sessions revoked');
    }

    // Check expiry
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Revoke the old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Generate new token pair in the same family
    const tokens = await this.generateAndStoreTokens(user, storedToken.family);
    return tokens;
  }

  async logout(refreshToken: string, req?: Request) {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, municipalityId: true } } },
    });

    if (storedToken) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });
      await this.audit.logFromRequest(req, {
        actorId: storedToken.user.id,
        actorEmail: storedToken.user.email,
        municipalityId: storedToken.user.municipalityId,
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
      });
    }

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string, req?: Request) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, municipalityId: true },
    });

    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: user?.email,
      municipalityId: user?.municipalityId,
      action: AUDIT_ACTIONS.AUTH_LOGOUT_ALL,
      metadata: { sessionsRevoked: result.count },
    });

    return { message: 'All sessions revoked' };
  }

  private async generateAndStoreTokens(
    user: { id: string; email: string; municipalityId: string | null; isSuperAdmin?: boolean },
    family?: string,
  ) {
    const tokenFamily = family || uuidv4();
    const tokenId = uuidv4();

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      municipalityId: user.municipalityId ?? '',
      ...(user.isSuperAdmin ? { isSuperAdmin: true } : {}),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, tokenId, family: tokenFamily },
      {
        expiresIn: '7d',
      },
    );

    // Store the refresh token hash
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family: tokenFamily,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Cleanup expired tokens (can be called via cron)
   */
  async cleanupExpiredTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    return { deleted: result.count };
  }

  // ==========================================================
  //  Password change
  // ==========================================================

  async changePassword(userId: string, dto: ChangePasswordDto, req?: Request) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current one');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    // Revoke all refresh tokens to force re-authentication on other devices
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE,
      resourceType: 'User',
      resourceId: userId,
    });

    return { message: 'Password changed successfully. Please log in again on other devices.' };
  }

  // ==========================================================
  // PASSWORD RESET (forgot password by email)
  // ==========================================================

  /**
   * Step 1 — request a reset link by email.
   * Always returns the same generic response, regardless of whether the
   * email exists, to avoid user enumeration. Rate-limit at the gateway.
   */
  async requestPasswordReset(email: string, req?: Request) {
    const generic = {
      message:
        'If an account exists for this email, a password reset link has been sent.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, firstName: true, isActive: true, locale: true },
    });

    // Throttle per-user: max 3 outstanding tokens in 15 min.
    if (user && user.isActive) {
      const recent = await this.prisma.passwordResetToken.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 15 * 60_000) },
          usedAt: null,
        },
      });
      if (recent >= 3) {
        return generic;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);
      const expiresInMinutes = 30;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          ipAddress: req?.ip,
          userAgent: (req?.headers?.['user-agent'] as string | undefined) ?? null,
        },
      });

      const baseUrl = this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3001';
      const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
      const tpl = this.mail.passwordReset(((user.locale as 'EN' | 'AR' | 'FR') ?? 'EN'), {
        resetUrl,
        expiresInMinutes,
        firstName: user.firstName,
      });
      const result = await this.mail
        .send({ to: user.email, event: 'reset_password', ...tpl })
        .catch((err) => ({
          delivered: false,
          provider: 'resend' as const,
          error: err instanceof Error ? err.message : 'unknown',
        }));

      await this.audit.logFromRequest(req, {
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.password.reset_requested',
        resourceType: 'User',
        resourceId: user.id,
        metadata: {
          delivered: result.delivered,
          provider: (result as any).provider,
          providerId: (result as any).providerId,
          reason: (result as any).error,
        },
      });
    }

    return generic;
  }

  /**
   * Step 2 — verify token + set new password.
   */
  async resetPassword(rawToken: string, newPassword: string, req?: Request) {
    if (!rawToken || newPassword.length < 8) {
      throw new BadRequestException('Invalid reset request.');
    }
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }
    if (!record.user.isActive) {
      throw new BadRequestException('Account is inactive.');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all other reset tokens for this user.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: new Date() },
      }),
      // Revoke active refresh tokens — force re-login on every device.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    await this.audit.logFromRequest(req, {
      actorId: record.userId,
      actorEmail: record.user.email,
      action: 'auth.password.reset_completed',
      resourceType: 'User',
      resourceId: record.userId,
    });

    return { message: 'Password updated. You can now sign in with your new password.' };
  }

  // ==========================================================
  // EMAIL VERIFICATION
  // ==========================================================

  /**
   * Send (or resend) an email verification link to the user. Always
   * returns the same generic message to avoid revealing whether an email
   * is registered. Rate-limited per-user (3 outstanding tokens / 15 min)
   * via the EmailOtp purpose=VERIFY_EMAIL row count.
   *
   * Delivery outcome is captured in the audit log metadata (delivered,
   * provider, providerId, reason) and in structured pino logs so an
   * operator can grep `event=verify_email.delivery_failed` to debug
   * silent suppression / bounce issues without exposing PII.
   */
  async sendEmailVerification(email: string, req?: Request) {
    const generic = {
      message:
        'If an account exists for this email, a verification link has been sent.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        isActive: true,
        emailVerifiedAt: true,
        locale: true,
      },
    });

    if (!user || !user.isActive || user.emailVerifiedAt) {
      // Don't leak existence or verified state. Always return ok, but
      // log internally so operators can correlate "user complained no
      // email arrived" with what actually happened.
      this.logger.log({
        event: 'verify_email.skipped',
        reason: !user
          ? 'no_account'
          : !user.isActive
          ? 'inactive'
          : 'already_verified',
        to: redactEmail(email),
      });
      return generic;
    }

    // Throttle: count outstanding verification tokens in the last 15 min.
    const recent = await this.prisma.emailOtp.count({
      where: {
        userId: user.id,
        purpose: 'VERIFY_EMAIL',
        createdAt: { gte: new Date(Date.now() - 15 * 60_000) },
        consumedAt: null,
      },
    });
    if (recent >= 3) {
      this.logger.warn({
        event: 'verify_email.rate_limited',
        userId: user.id,
        to: redactEmail(user.email),
        outstandingTokens: recent,
      });
      await this.audit.logFromRequest(req, {
        actorId: user.id,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.AUTH_EMAIL_VERIFICATION_REQUEST,
        resourceType: 'User',
        resourceId: user.id,
        metadata: { delivered: false, reason: 'rate_limited' },
      });
      return generic;
    }

    // Mint a single-use, hashed verification token (long random string,
    // not a 6-digit OTP — we use the link form for verification).
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresInMinutes = 60;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);
    await this.prisma.emailOtp.create({
      data: {
        userId: user.id,
        purpose: 'VERIFY_EMAIL',
        codeHash: tokenHash,
        expiresAt,
      },
    });

    const baseUrl =
      this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3001';
    const verifyUrl = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${rawToken}`;
    const tpl = this.mail.emailVerification(
      ((user.locale as 'EN' | 'AR' | 'FR') ?? 'EN'),
      { verifyUrl, expiresInMinutes, firstName: user.firstName },
    );
    // Best-effort: never throw. MailService logs delivery outcome and
    // returns a structured result we forward into the audit log.
    const result = await this.mail
      .send({ to: user.email, event: 'verify_email', ...tpl })
      .catch((err) => ({
        delivered: false,
        provider: 'resend' as const,
        error: err instanceof Error ? err.message : 'unknown',
      }));

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.AUTH_EMAIL_VERIFICATION_REQUEST,
      resourceType: 'User',
      resourceId: user.id,
      metadata: {
        delivered: result.delivered,
        provider: (result as any).provider,
        providerId: (result as any).providerId,
        reason: (result as any).error,
      },
    });

    return generic;
  }

  /**
   * Complete email verification using the token from the email link.
   * Single-use: the token's `consumedAt` is set on success.
   */
  async verifyEmail(rawToken: string, req?: Request) {
    if (!rawToken) {
      throw new BadRequestException('Verification token is required.');
    }
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.emailOtp.findFirst({
      where: { codeHash: tokenHash, purpose: 'VERIFY_EMAIL' },
      include: { user: true },
    });
    if (!record) {
      throw new BadRequestException(
        'Verification link is invalid or has expired.',
      );
    }

    // Idempotent: link already used or user verified (e.g. React Strict Mode double-submit).
    if (record.user.emailVerifiedAt) {
      return {
        message: 'Email already verified.',
        alreadyVerified: true as const,
      };
    }

    if (record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'Verification link is invalid or has expired.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // Invalidate other outstanding verification tokens for this user.
      this.prisma.emailOtp.updateMany({
        where: {
          userId: record.userId,
          purpose: 'VERIFY_EMAIL',
          consumedAt: null,
          id: { not: record.id },
        },
        data: { consumedAt: new Date() },
      }),
    ]);

    await this.audit.logFromRequest(req, {
      actorId: record.userId,
      actorEmail: record.user.email,
      action: AUDIT_ACTIONS.AUTH_EMAIL_VERIFICATION_COMPLETE,
      resourceType: 'User',
      resourceId: record.userId,
    });

    return {
      message: 'Email verified successfully.',
      alreadyVerified: false as const,
    };
  }

  // ==========================================================
  // EMAIL 2FA
  // ==========================================================

  /**
   * Enable email-based 2FA for the current user. Requires the user's
   * password (defence-in-depth) and a verified email — we don't want
   * to lock users out by sending OTPs to an unverified address.
   */
  async enableEmailTwoFactor(userId: string, password: string, req?: Request) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Password is incorrect');

    if (!user.emailVerifiedAt) {
      throw new BadRequestException(
        'Verify your email before enabling email-based 2FA.',
      );
    }

    if (user.twoFactorEnabled && (user as any).twoFactorMethod === 'EMAIL') {
      throw new BadRequestException('Email-based 2FA is already enabled');
    }

    await this.clearEmailOtps(userId, ['LOGIN_2FA', 'DISABLE_2FA']);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: 'EMAIL',
        // Clear any TOTP secret so login goes through the email path.
        twoFactorSecret: null,
      },
    });

    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_2FA_EMAIL_ENABLE,
      resourceType: 'User',
      resourceId: userId,
    });

    return { enabled: true, method: 'EMAIL' as const };
  }

  /** Invalidate unconsumed email OTPs for the given purposes. */
  private async clearEmailOtps(userId: string, purposes: string[]) {
    await this.prisma.emailOtp.updateMany({
      where: { userId, purpose: { in: purposes }, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  /**
   * Issue a 6-digit email OTP (hashed at rest). Used for login and disable flows.
   * Never logs the plaintext code.
   */
  private async issueEmailOtp(
    user: { id: string; email: string; firstName: string; locale: any },
    purpose: 'LOGIN_2FA' | 'DISABLE_2FA',
    req?: Request,
    auditAction: string = AUDIT_ACTIONS.AUTH_2FA_EMAIL_OTP_REQUEST,
    mailEvent: string = 'login_2fa_otp',
    mailPurpose: 'LOGIN' | 'GENERIC' = 'LOGIN',
    rateLimitMessage = 'Too many codes requested. Please try again in a few minutes.',
  ) {
    const recent = await this.prisma.emailOtp.count({
      where: {
        userId: user.id,
        purpose,
        createdAt: { gte: new Date(Date.now() - 15 * 60_000) },
      },
    });
    if (recent >= 5) {
      throw new BadRequestException(rateLimitMessage);
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = this.hashToken(code);
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);

    await this.prisma.emailOtp.create({
      data: { userId: user.id, purpose, codeHash, expiresAt },
    });

    const tpl = this.mail.emailOtp(
      ((user.locale as 'EN' | 'AR' | 'FR') ?? 'EN'),
      { code, expiresInMinutes, purpose: mailPurpose },
    );
    const result = await this.mail
      .send({ to: user.email, event: mailEvent, ...tpl })
      .catch((err) => ({
        delivered: false,
        provider: 'resend' as const,
        error: err instanceof Error ? err.message : 'unknown',
      }));

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      action: auditAction,
      metadata: {
        purpose,
        delivered: result.delivered,
        provider: (result as any).provider,
        providerId: (result as any).providerId,
        reason: (result as any).error,
      },
    });
  }

  private async issueEmailOtpForLogin(
    user: { id: string; email: string; firstName: string; locale: any },
    req?: Request,
  ) {
    return this.issueEmailOtp(
      user,
      'LOGIN_2FA',
      req,
      AUDIT_ACTIONS.AUTH_2FA_EMAIL_OTP_REQUEST,
      'login_2fa_otp',
      'LOGIN',
      'Too many sign-in codes requested. Please try again in a few minutes.',
    );
  }

  /**
   * Resend the email OTP for an in-flight 2FA login. Validates the
   * challenge token first so anonymous flooding can't trigger emails.
   */
  async resendEmailTwoFactorCode(challengeToken: string, req?: Request) {
    let payload: any;
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }
    if (payload?.twoFactor !== 'challenge' || !payload.sub) {
      throw new UnauthorizedException('Invalid challenge token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        locale: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    if (!user.twoFactorEnabled || user.twoFactorMethod !== 'EMAIL') {
      throw new BadRequestException(
        'Email 2FA is not enabled for this account.',
      );
    }
    await this.issueEmailOtpForLogin(user as any, req);
    return { message: 'A new sign-in code has been sent to your email.' };
  }

  /**
   * Complete an email-2FA login. Validates the challenge token + email
   * OTP, then issues full access/refresh tokens (same shape as TOTP).
   */
  async completeEmailTwoFactorLogin(
    challengeToken: string,
    code: string,
    req?: Request,
  ) {
    let payload: any;
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }
    if (payload?.twoFactor !== 'challenge' || !payload.sub) {
      throw new UnauthorizedException('Invalid challenge token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    if (!user.twoFactorEnabled || (user as any).twoFactorMethod !== 'EMAIL') {
      throw new BadRequestException(
        'Email 2FA is not enabled for this account.',
      );
    }

    const codeHash = this.hashToken(code);
    const otp = await this.prisma.emailOtp.findFirst({
      where: {
        userId: user.id,
        purpose: 'LOGIN_2FA',
        codeHash,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      // Increment attempts on the most recent un-consumed code if hash
      // mismatch (hide whether a code exists by always counting).
      const latest = await this.prisma.emailOtp.findFirst({
        where: { userId: user.id, purpose: 'LOGIN_2FA', consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        await this.prisma.emailOtp.update({
          where: { id: latest.id },
          data: { attempts: { increment: 1 } },
        });
        if (latest.attempts + 1 >= 5) {
          await this.prisma.emailOtp.update({
            where: { id: latest.id },
            data: { consumedAt: new Date() },
          });
        }
      }
      throw new UnauthorizedException('Invalid or expired sign-in code.');
    }

    await this.prisma.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    const { accessToken, refreshToken } = await this.generateAndStoreTokens(user);

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_2FA_EMAIL_LOGIN,
    });

    return {
      user: await this.getProfile(user.id),
      accessToken,
      refreshToken,
    };
  }

  // ==========================================================
  //  Avatar upload
  // ==========================================================

  async uploadAvatar(userId: string, file: Express.Multer.File, req?: Request) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Avatar must be an image');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Avatar must be smaller than 5MB');
    }

    const url = await this.storageService.saveFile(file, 'avatars');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
      select: { email: true, municipalityId: true },
    });

    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_AVATAR_UPLOAD,
      resourceType: 'User',
      resourceId: userId,
    });

    return { avatarUrl: url };
  }

  // ==========================================================
  //  Two-Factor Authentication (TOTP)
  // ==========================================================

  /**
   * Begin 2FA setup. Returns a base32 secret (kept tentatively in DB but flagged disabled)
   * plus the otpauth URL and a data-URL QR code image.
   */
  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true, twoFactorMethod: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (
      user.twoFactorEnabled &&
      (user as any).twoFactorMethod !== 'EMAIL'
    ) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const secret = speakeasy.generateSecret({
      name: `Baladi (${user.email})`,
      issuer: 'Baladi',
      length: 20,
    });

    // Store the candidate secret. When switching from EMAIL, keep 2FA enabled
    // until verify succeeds so the account is never left without a second factor.
    const switchingFromEmail =
      user.twoFactorEnabled && (user as any).twoFactorMethod === 'EMAIL';
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
        ...(switchingFromEmail ? {} : { twoFactorEnabled: false }),
      },
    });

    const otpauthUrl = secret.otpauth_url ?? '';
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      secret: secret.base32,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /** Verify a TOTP code and enable 2FA. */
  async verifyAndEnableTwoFactor(userId: string, code: string, req?: Request) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        email: true,
        municipalityId: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (
      user.twoFactorEnabled &&
      (user as any).twoFactorMethod !== 'EMAIL'
    ) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Two-factor setup has not been started. Call /auth/2fa/setup first.');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.clearEmailOtps(userId, ['LOGIN_2FA', 'DISABLE_2FA']);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: 'TOTP',
      },
    });

    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_2FA_ENABLE,
      resourceType: 'User',
      resourceId: userId,
    });

    return { enabled: true };
  }

  /** Disable TOTP 2FA. Requires password + a current authenticator code. */
  async disableTwoFactor(userId: string, password: string, code: string, req?: Request) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    const method = (user as any).twoFactorMethod ?? 'TOTP';
    if (method === 'EMAIL') {
      throw new BadRequestException(
        'Email-based 2FA cannot be disabled with an authenticator code. Request a disable code by email first.',
      );
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Authenticator 2FA is not configured for this account');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await this.audit.logFromRequest(req, {
        actorId: userId,
        actorEmail: user.email,
        municipalityId: user.municipalityId,
        action: AUDIT_ACTIONS.AUTH_2FA_DISABLE_FAILED,
        resourceType: 'User',
        resourceId: userId,
        metadata: { method: 'TOTP', reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Password is incorrect');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!verified) {
      await this.audit.logFromRequest(req, {
        actorId: userId,
        actorEmail: user.email,
        municipalityId: user.municipalityId,
        action: AUDIT_ACTIONS.AUTH_2FA_DISABLE_FAILED,
        resourceType: 'User',
        resourceId: userId,
        metadata: { method: 'TOTP', reason: 'invalid_code' },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.clearEmailOtps(userId, ['LOGIN_2FA', 'DISABLE_2FA']);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_2FA_DISABLE,
      resourceType: 'User',
      resourceId: userId,
      metadata: { method: 'TOTP' },
    });

    return { disabled: true };
  }

  /** Step 1: email a single-use OTP to confirm disabling email-based 2FA. */
  async requestDisableEmailTwoFactor(userId: string, password: string, req?: Request) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        locale: true,
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        municipalityId: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFactorEnabled || user.twoFactorMethod !== 'EMAIL') {
      throw new BadRequestException('Email-based 2FA is not enabled');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await this.audit.logFromRequest(req, {
        actorId: userId,
        actorEmail: user.email,
        municipalityId: user.municipalityId,
        action: AUDIT_ACTIONS.AUTH_2FA_DISABLE_FAILED,
        resourceType: 'User',
        resourceId: userId,
        metadata: { method: 'EMAIL', reason: 'invalid_password', step: 'request' },
      });
      throw new UnauthorizedException('Password is incorrect');
    }

    await this.clearEmailOtps(userId, ['DISABLE_2FA']);

    await this.issueEmailOtp(
      user as any,
      'DISABLE_2FA',
      req,
      AUDIT_ACTIONS.AUTH_2FA_DISABLE_EMAIL_OTP_REQUEST,
      'disable_2fa_otp',
      'GENERIC',
      'Too many disable codes requested. Please try again in a few minutes.',
    );

    return { message: 'A confirmation code has been sent to your email.' };
  }

  /** Step 2: confirm disable with password + emailed OTP. */
  async confirmDisableEmailTwoFactor(
    userId: string,
    password: string,
    code: string,
    req?: Request,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFactorEnabled || (user as any).twoFactorMethod !== 'EMAIL') {
      throw new BadRequestException('Email-based 2FA is not enabled');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await this.audit.logFromRequest(req, {
        actorId: userId,
        actorEmail: user.email,
        municipalityId: user.municipalityId,
        action: AUDIT_ACTIONS.AUTH_2FA_DISABLE_FAILED,
        resourceType: 'User',
        resourceId: userId,
        metadata: { method: 'EMAIL', reason: 'invalid_password', step: 'confirm' },
      });
      throw new UnauthorizedException('Password is incorrect');
    }

    const codeHash = this.hashToken(code);
    const otp = await this.prisma.emailOtp.findFirst({
      where: {
        userId,
        purpose: 'DISABLE_2FA',
        codeHash,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      const latest = await this.prisma.emailOtp.findFirst({
        where: { userId, purpose: 'DISABLE_2FA', consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        await this.prisma.emailOtp.update({
          where: { id: latest.id },
          data: { attempts: { increment: 1 } },
        });
        if (latest.attempts + 1 >= 5) {
          await this.prisma.emailOtp.update({
            where: { id: latest.id },
            data: { consumedAt: new Date() },
          });
        }
      }
      await this.audit.logFromRequest(req, {
        actorId: userId,
        actorEmail: user.email,
        municipalityId: user.municipalityId,
        action: AUDIT_ACTIONS.AUTH_2FA_DISABLE_FAILED,
        resourceType: 'User',
        resourceId: userId,
        metadata: { method: 'EMAIL', reason: 'invalid_code', step: 'confirm' },
      });
      throw new UnauthorizedException('Invalid or expired confirmation code.');
    }

    await this.prisma.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    await this.clearEmailOtps(userId, ['LOGIN_2FA', 'DISABLE_2FA']);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    await this.audit.logFromRequest(req, {
      actorId: userId,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_2FA_DISABLE,
      resourceType: 'User',
      resourceId: userId,
      metadata: { method: 'EMAIL' },
    });

    return { disabled: true };
  }

  /**
   * Complete 2FA login: validate the challenge token + the TOTP code,
   * then issue full access/refresh tokens.
   */
  async completeTwoFactorLogin(challengeToken: string, code: string, req?: Request) {
    let payload: any;
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }
    if (payload?.twoFactor !== 'challenge' || !payload.sub) {
      throw new UnauthorizedException('Invalid challenge token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    const method = (user as any).twoFactorMethod ?? 'TOTP';
    if (!user.twoFactorEnabled || method !== 'TOTP') {
      throw new BadRequestException(
        'This account uses email-based 2FA. Use /auth/2fa/email/login instead.',
      );
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled for this account');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!verified) throw new UnauthorizedException('Invalid verification code');

    const { accessToken, refreshToken } = await this.generateAndStoreTokens(user);

    await this.audit.logFromRequest(req, {
      actorId: user.id,
      actorEmail: user.email,
      municipalityId: user.municipalityId,
      action: AUDIT_ACTIONS.AUTH_2FA_LOGIN,
      metadata: { method: 'TOTP' },
    });

    return {
      user: await this.getProfile(user.id),
      accessToken,
      refreshToken,
    };
  }
}
