import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface AuditLogParams {
  actorId?: string | null;
  actorEmail?: string | null;
  municipalityId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/** Standardized audit action keys (so search/grouping is consistent). */
export const AUDIT_ACTIONS = {
  // Auth
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_LOGOUT_ALL: 'auth.logout_all',
  AUTH_REGISTER: 'auth.register',
  AUTH_PASSWORD_CHANGE: 'auth.password.change',
  AUTH_2FA_ENABLE: 'auth.2fa.enable',
  AUTH_2FA_DISABLE: 'auth.2fa.disable',
  AUTH_2FA_LOGIN: 'auth.2fa.login.success',
  AUTH_AVATAR_UPLOAD: 'auth.avatar.upload',
  AUTH_PASSWORD_RESET_REQUEST: 'auth.password.reset_requested',
  AUTH_PASSWORD_RESET_COMPLETE: 'auth.password.reset_completed',
  AUTH_EMAIL_VERIFICATION_REQUEST: 'auth.email.verification_requested',
  AUTH_EMAIL_VERIFICATION_COMPLETE: 'auth.email.verification_completed',
  AUTH_2FA_EMAIL_ENABLE: 'auth.2fa.email.enable',
  AUTH_2FA_EMAIL_LOGIN: 'auth.2fa.email.login.success',
  AUTH_2FA_EMAIL_OTP_REQUEST: 'auth.2fa.email.otp_requested',
  AUTH_2FA_DISABLE_EMAIL_OTP_REQUEST: 'auth.2fa.disable.email.otp_requested',
  AUTH_2FA_DISABLE_FAILED: 'auth.2fa.disable.failed',
  // Users (tenant)
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_ROLE_ASSIGN: 'user.role.assign',
  USER_ROLE_REMOVE: 'user.role.remove',
  USER_GOVERNANCE_DENIED: 'user.governance.denied',
  // Complaints
  COMPLAINT_CREATE: 'complaint.create',
  COMPLAINT_ASSIGN: 'complaint.assign',
  COMPLAINT_STATUS_CHANGE: 'complaint.status.change',
  COMPLAINT_REJECT: 'complaint.reject',
  COMPLAINT_CLASSIFY: 'complaint.classify',
  COMPLAINT_DELETE: 'complaint.delete',
  COMPLAINT_RISKY_ACCEPTED: 'complaint.risky.accepted',
  // Categories
  CATEGORY_CREATE: 'category.create',
  CATEGORY_UPDATE: 'category.update',
  CATEGORY_ACTIVATE: 'category.activate',
  CATEGORY_DEACTIVATE: 'category.deactivate',
  CATEGORY_DELETE: 'category.delete',
  CATEGORY_MOVE_DEPARTMENT: 'category.move_department',
  // KYC
  KYC_SUBMIT: 'kyc.submit',
  KYC_APPROVE: 'kyc.approve',
  KYC_REJECT: 'kyc.reject',
  KYC_OVERRIDE: 'kyc.override',
  // Platform
  PLATFORM_MUNICIPALITY_CREATE: 'platform.municipality.create',
  PLATFORM_MUNICIPALITY_UPDATE: 'platform.municipality.update',
  PLATFORM_MUNICIPALITY_BOUNDARY_CREATE: 'platform.municipality.boundary.create',
  PLATFORM_MUNICIPALITY_BOUNDARY_UPDATE: 'platform.municipality.boundary.update',
  PLATFORM_MUNICIPALITY_BOUNDARY_DEACTIVATE: 'platform.municipality.boundary.deactivate',
  PLATFORM_USER_ACTIVATE: 'platform.user.activate',
  PLATFORM_USER_DEACTIVATE: 'platform.user.deactivate',
  PLATFORM_USER_DELETE: 'platform.user.delete',
  PLATFORM_USER_RESET_PASSWORD: 'platform.user.reset_password',
  PLATFORM_USER_RESET_2FA: 'platform.user.reset_2fa',
  PLATFORM_USER_VERIFY_EMAIL: 'platform.user.verify_email',
  PLATFORM_USER_FORCE_LOGOUT: 'platform.user.force_logout',
  PLATFORM_TRANSFER_ADMIN: 'platform.municipality.transfer_admin',
  PLATFORM_IMPERSONATE: 'platform.impersonate',
  PLATFORM_MAINTENANCE_ON: 'platform.maintenance.enable',
  PLATFORM_MAINTENANCE_OFF: 'platform.maintenance.disable',
  PLATFORM_SETTING_UPDATE: 'platform.setting.update',
  PLATFORM_BROADCAST_SEND: 'platform.broadcast.send',
  PLATFORM_BROADCAST_PREVIEW: 'platform.broadcast.preview',
} as const;

/** Extracts client IP and user-agent from an Express request, normalizing X-Forwarded-For. */
export function extractRequestContext(req?: Request | null): {
  ipAddress?: string;
  userAgent?: string;
} {
  if (!req) return {};
  const xff = req.headers?.['x-forwarded-for'];
  const ipFromXff = Array.isArray(xff)
    ? xff[0]
    : typeof xff === 'string'
    ? xff.split(',')[0]?.trim()
    : undefined;
  const ipAddress = ipFromXff || req.socket?.remoteAddress || undefined;
  const ua = req.headers?.['user-agent'];
  const userAgent = Array.isArray(ua) ? ua[0] : ua;
  return { ipAddress, userAgent };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Record an audit log entry. Failures are swallowed (logged) — audit must never break the request.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId ?? null,
          actorEmail: params.actorEmail ?? null,
          municipalityId: params.municipalityId ?? null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          ipAddress: params.ipAddress?.slice(0, 64),
          userAgent: params.userAgent?.slice(0, 500),
          metadata: params.metadata ? (params.metadata as any) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  /** Convenience: log + automatically pull IP/UA from an Express request. */
  async logFromRequest(req: Request | undefined | null, params: AuditLogParams): Promise<void> {
    const ctx = extractRequestContext(req);
    return this.log({
      ...params,
      ipAddress: params.ipAddress ?? ctx.ipAddress,
      userAgent: params.userAgent ?? ctx.userAgent,
    });
  }

  async query(opts: {
    municipalityId?: string;
    actorId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, opts.limit ?? 50);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.municipalityId) where.municipalityId = opts.municipalityId;
    if (opts.actorId) where.actorId = opts.actorId;
    if (opts.action) where.action = { contains: opts.action };
    if (opts.resourceType) where.resourceType = opts.resourceType;
    if (opts.resourceId) where.resourceId = opts.resourceId;
    if (opts.from || opts.to) {
      where.createdAt = {};
      if (opts.from) where.createdAt.gte = opts.from;
      if (opts.to) where.createdAt.lte = opts.to;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
