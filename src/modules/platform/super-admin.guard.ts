import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../core/auth/decorators/public.decorator';

/**
 * Defense-in-depth: every /platform/* endpoint requires the user to have
 * isSuperAdmin = true on their JWT/User record, in addition to permission checks.
 * This prevents a misconfigured municipality role from ever accessing platform features.
 *
 * Endpoints marked @Public() (e.g. GET /platform/branding for the citizen portal)
 * bypass this guard so unauthenticated visitors can read platform branding.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.isSuperAdmin) {
      throw new ForbiddenException(
        'This endpoint is restricted to platform super administrators',
      );
    }

    return true;
  }
}
