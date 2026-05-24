import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const IS_WEB_ONLY = 'isWebOnly';

/**
 * Endpoints decorated with @WebOnly() will reject calls coming from the mobile app.
 * The mobile app sends the `X-Client-Platform: mobile` header on every request;
 * any request with that header will get a 403 Forbidden here.
 *
 * Web requests (no header, or `web`) are allowed through.
 *
 * NOTE: this is a soft control intended for *UX* (the mobile app shouldn't accidentally
 * surface admin features). It is NOT a security boundary by itself — backend permissions
 * still gate every endpoint. A determined attacker could spoof the header.
 */
@Injectable()
export class WebOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isWebOnly = this.reflector.getAllAndOverride<boolean>(IS_WEB_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isWebOnly) return true;

    const req = context.switchToHttp().getRequest();
    const platform = (req.headers['x-client-platform'] || '').toString().toLowerCase();

    if (platform === 'mobile') {
      throw new ForbiddenException(
        'This feature is only available in the web administration dashboard.',
      );
    }

    return true;
  }
}
