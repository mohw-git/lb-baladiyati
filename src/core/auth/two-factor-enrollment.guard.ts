import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserData } from './types/jwt-payload';

/** Routes staff may call while 2FA enrollment is still required. */
const ALLOWED_PATH_PREFIXES = [
  '/auth/me',
  '/auth/logout',
  '/auth/logout-all',
  '/auth/change-password',
  '/auth/2fa/',
  '/auth/me/avatar',
];

/**
 * Blocks authenticated API access for staff who must enrol in 2FA but have not
 * yet done so. Profile and 2FA management endpoints remain reachable.
 */
@Injectable()
export class TwoFactorEnrollmentGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as CurrentUserData | undefined;
    if (!user?.id) return true;

    const path: string = (req.path || req.url || '').split('?')[0];
    if (ALLOWED_PATH_PREFIXES.some((p) => path.startsWith(p))) {
      return true;
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        twoFactorEnabled: true,
        createdVia: true,
        isActive: true,
      },
    });
    if (!dbUser?.isActive) return true;
    if (dbUser.twoFactorEnabled) return true;

    const isStaff = dbUser.createdVia !== 'SELF_REGISTRATION';
    if (!isStaff) return true;

    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: 'auth.require_2fa_staff' },
    });
    if (setting?.value !== 'true') return true;

    throw new ForbiddenException({
      code: 'MUST_ENROLL_TWO_FACTOR',
      message:
        'Two-factor authentication is required for your account. Complete 2FA setup before using the application.',
    });
  }
}
