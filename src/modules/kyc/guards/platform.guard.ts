import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that enforces mobile-only access.
 * Checks X-Client-Platform header and user-agent for mobile indicators.
 *
 * SECURITY NOTE: Header-based enforcement can be spoofed.
 * This is a defense-in-depth measure, not a cryptographic guarantee.
 */
@Injectable()
export class MobilePlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const platform = request.headers['x-client-platform'];

    if (!platform || platform.toUpperCase() !== 'MOBILE') {
      throw new ForbiddenException(
        'This endpoint is only available from the mobile application',
      );
    }

    // Additional user-agent validation (defense in depth)
    const userAgent = (request.headers['user-agent'] || '').toLowerCase();
    const mobileIndicators = ['expo', 'okhttp', 'cfnetwork', 'darwin', 'android', 'iphone', 'ipad'];
    const isMobileUA = mobileIndicators.some((indicator) =>
      userAgent.includes(indicator),
    );

    if (!isMobileUA && !userAgent.includes('postman') && !userAgent.includes('insomnia')) {
      throw new ForbiddenException(
        'KYC submission requires a mobile device',
      );
    }

    return true;
  }
}
