import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

/**
 * Blocks all incoming requests with HTTP 503 while maintenance mode is enabled,
 * EXCEPT:
 *   - Super admins (so they can read stats / turn maintenance off)
 *   - The maintenance-control endpoints themselves (always reachable by super admin)
 *   - The auth/me endpoint (so the existing UI session can recover)
 *
 * The flag is cached in memory for 10 s to avoid hammering the DB.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  private readonly logger = new Logger(MaintenanceGuard.name);
  private cache: { enabled: boolean; message: string; ts: number } | null = null;
  private static readonly CACHE_TTL_MS = 10_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  /** Force the cache to refresh on the next request (called when toggle changes). */
  static invalidateCache: () => void = () => {};

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const url: string = req.originalUrl || req.url || '';

    // Always let public auth endpoints through (login, refresh, etc.)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Always let super admins through (so they can disable maintenance)
    const user = req.user;
    if (user?.isSuperAdmin) return true;

    // Always allow the platform endpoints themselves (super admin only anyway)
    if (url.startsWith('/platform') || url.startsWith('/api/platform')) return true;
    // Always allow profile endpoint so the UI can hydrate / show banner
    if (url.includes('/auth/me')) return true;

    const status = await this.getStatus();
    if (!status.enabled) return true;

    throw new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        code: 'MAINTENANCE_MODE',
        message:
          status.message ||
          'The platform is currently undergoing maintenance. Please try again later.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private async getStatus(): Promise<{ enabled: boolean; message: string }> {
    const now = Date.now();
    if (this.cache && now - this.cache.ts < MaintenanceGuard.CACHE_TTL_MS) {
      return { enabled: this.cache.enabled, message: this.cache.message };
    }
    try {
      const rows = await this.prisma.platformSetting.findMany({
        where: { key: { in: ['maintenance.enabled', 'maintenance.message'] } },
      });
      const enabled =
        rows.find((r) => r.key === 'maintenance.enabled')?.value === 'true';
      const message =
        rows.find((r) => r.key === 'maintenance.message')?.value ?? '';
      this.cache = { enabled, message, ts: now };
      return { enabled, message };
    } catch (err) {
      this.logger.warn(`Maintenance check failed: ${(err as Error).message}`);
      // Fail open — better to let traffic through than to break the platform.
      return { enabled: false, message: '' };
    }
  }
}
