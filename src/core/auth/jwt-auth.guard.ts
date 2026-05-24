import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // For public endpoints, still try to parse the JWT if present
      // so authenticated users get their context (e.g., admin seeing drafts)
      // but don't fail if there's no token
      try {
        const result = await (super.canActivate(context) as Promise<boolean>);
        return result;
      } catch {
        // No token or invalid token — that's fine for public endpoints
        return true;
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
