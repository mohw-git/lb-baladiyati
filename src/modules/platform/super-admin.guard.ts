import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Defense-in-depth: every /platform/* endpoint requires the user to have
 * isSuperAdmin = true on their JWT/User record, in addition to permission checks.
 * This prevents a misconfigured municipality role from ever accessing platform features.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
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
