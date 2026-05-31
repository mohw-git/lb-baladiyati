import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { ErrorCode, ErrorDetail } from '../dto/api-response.dto';

interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
    /**
     * Arbitrary structured context for the error — e.g. the `email`
     * field on an EMAIL_NOT_VERIFIED 403 so the client can prefill the
     * Resend form. Anything passed in the exception body other than
     * `message`/`code`/`statusCode`/`details` lands here.
     */
    meta?: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string = ErrorCode.INTERNAL_ERROR;
    let details: ErrorDetail[] | undefined = undefined;
    let meta: Record<string, unknown> | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        
        // Handle class-validator validation errors
        if (Array.isArray(res.message)) {
          code = ErrorCode.VALIDATION_ERROR;
          details = this.formatValidationErrors(res.message);
          message =
            details?.map((d) => d.message).filter(Boolean).join('; ') || 'Validation failed';
        } else {
          message = (res.message as string) || exception.message;
          // Check for custom error code in response
          if (res.code) {
            code = res.code as string;
          } else {
            code = this.getErrorCode(status);
          }
        }

        // Any extra fields on the exception body (e.g. `email` on an
        // EMAIL_NOT_VERIFIED 403) are forwarded under `error.meta` so
        // the client can act on them without having to parse the
        // message string.
        const reserved = new Set([
          'message',
          'code',
          'statusCode',
          'error',
          'details',
        ]);
        const extras: Record<string, unknown> = {};
        for (const key of Object.keys(res)) {
          if (!reserved.has(key)) extras[key] = res[key];
        }
        if (Object.keys(extras).length > 0) meta = extras;
      }

      // Override code for specific exception types
      if (code === ErrorCode.BAD_REQUEST && exception instanceof BadRequestException) {
        const resp = exception.getResponse() as any;
        if (Array.isArray(resp?.message)) {
          code = ErrorCode.VALIDATION_ERROR;
        }
      }
    } else if (exception instanceof Error) {
      // Log full details internally
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      // Never expose internal error details to clients in production
      const isProduction = process.env.NODE_ENV === 'production';
      message = isProduction ? 'Internal server error' : exception.message;
    } else {
      this.logger.error(`Unknown exception thrown`, exception);
    }

    const errorResponse: StandardErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
        ...(meta && { meta }),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log error for debugging
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );

      // Forward server-side errors to Sentry (no-op if SENTRY_DSN unset).
      // 4xx errors (validation, auth, not found) are NOT sent — they are
      // expected client mistakes, not bugs.
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(exception, {
          tags: {
            path: request.url,
            method: request.method,
            statusCode: String(status),
          },
        });
      }
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Format class-validator errors into standardized format
   */
  private formatValidationErrors(messages: string[] | object[]): ErrorDetail[] {
    if (!messages.length) return [];

    // If messages are already objects with constraints
    if (typeof messages[0] === 'object') {
      return (messages as any[]).map((err) => ({
        field: err.property || 'unknown',
        message: Object.values(err.constraints || {})[0] as string || err.message || 'Invalid value',
        value: err.value,
      }));
    }

    // If messages are plain strings (from ValidationPipe)
    return (messages as string[]).map((msg) => {
      // Try to extract field name from message like "email must be an email"
      const match = msg.match(/^(\w+)\s/);
      return {
        field: match ? match[1] : 'unknown',
        message: msg,
      };
    });
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: ErrorCode.BAD_REQUEST,
      401: ErrorCode.UNAUTHORIZED,
      403: ErrorCode.FORBIDDEN,
      404: ErrorCode.NOT_FOUND,
      409: ErrorCode.CONFLICT,
      422: ErrorCode.VALIDATION_ERROR,
      429: ErrorCode.TOO_MANY_REQUESTS,
      500: ErrorCode.INTERNAL_ERROR,
    };
    return codes[status] || 'ERROR';
  }
}
