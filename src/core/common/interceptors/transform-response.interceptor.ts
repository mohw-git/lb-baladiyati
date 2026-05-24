import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Decorator to skip response transformation for specific endpoints
 */
export const SkipTransform = () => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(SKIP_TRANSFORM_KEY, true, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(SKIP_TRANSFORM_KEY, true, target);
    return target;
  };
};

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    // Check if transformation should be skipped
    const skipTransform = this.reflector.get<boolean>(
      SKIP_TRANSFORM_KEY,
      context.getHandler(),
    );

    if (skipTransform) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If response is already in standard format, return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Check if it's a paginated response (has data array and meta)
        if (
          data &&
          typeof data === 'object' &&
          Array.isArray(data.data) &&
          data.meta
        ) {
          return {
            success: true,
            data: data.data,
            meta: data.meta,
          };
        }

        // Wrap in standard format
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
