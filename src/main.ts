// Sentry MUST be imported first, before anything from the app, so its
// auto-instrumentation can patch Node modules at load time. The init is a
// no-op when SENTRY_DSN is unset.
import './instrument';
import * as Sentry from '@sentry/node';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from './core/common/interceptors/transform-response.interceptor';
import { assertProductionEnvOrExit } from './core/config/production-validator';

async function bootstrap() {
  // Fail-fast safety net: in production, refuse to start the app if any
  // env value is still a placeholder, points at localhost, or is unsafe.
  // In dev/test, this only logs warnings.
  assertProductionEnvOrExit();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Swap default Nest logger for pino so internal Nest logs are also JSON.
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Block public access to KYC upload directory (PII protection)
  // Files are only accessible via authenticated /admin/kyc/.../attachments/... endpoint
  app.use('/uploads/kyc', (_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    });
  });

  // Global validation pipe with detailed error messages
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false,
    }),
  );

  // Sentry: hook into the underlying express instance so unhandled errors
  // bubble up to Sentry before our HttpExceptionFilter sanitizes the response.
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app.getHttpAdapter().getInstance());
  }

  // Global exception filter for standardized error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global response interceptor for standardized success responses
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new TransformResponseInterceptor(reflector));

  // CORS — allowlist origins from env.
  //
  // Resolution order:
  //   1. CORS_ORIGINS (comma-separated) — explicit override
  //   2. FRONTEND_URL (single origin) — common case in production
  //   3. Common dev origins (localhost / Expo / Metro) — ONLY in non-prod
  //
  // Production hardening:
  //   - Localhost / 127.0.0.1 / LAN-IP origins are NEVER allowed.
  //   - Non-https origins are dropped with a warning.
  //   - Mobile-app requests have no Origin header and are always allowed.
  const defaultDevOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8081',
    'http://localhost:19006',
    'http://localhost:19000',
  ];
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const explicitOrigins = process.env.CORS_ORIGINS?.trim();
  let corsOrigins = (
    explicitOrigins
      ? explicitOrigins.split(',')
      : frontendUrl
        ? [frontendUrl, ...(isProduction ? [] : defaultDevOrigins)]
        : isProduction
          ? []
          : defaultDevOrigins
  )
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (isProduction) {
    const before = corsOrigins.length;
    corsOrigins = corsOrigins.filter((origin) => {
      if (
        /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(:\d+)?$/i.test(
          origin,
        )
      ) {
        logger.warn(`CORS: dropping localhost origin in production: ${origin}`);
        return false;
      }
      if (!/^https:\/\//i.test(origin) && origin !== '*') {
        logger.warn(`CORS: dropping non-https origin in production: ${origin}`);
        return false;
      }
      return true;
    });
    if (before > 0 && corsOrigins.length === 0) {
      logger.error(
        'CORS: no valid production origins after filtering. ' +
          'Set CORS_ORIGINS or FRONTEND_URL to a real https URL.',
      );
    }
  }

  // Also allow any LAN IP origin in dev (Expo Go on physical devices, dashboard tested from phone, etc.)
  const isLanOrigin = (origin: string): boolean => {
    if (isProduction) return false;
    return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(
      origin,
    );
  };

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server, same-origin)
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (
        corsOrigins.includes('*') ||
        corsOrigins.includes(normalized) ||
        isLanOrigin(normalized)
      ) {
        return callback(null, true);
      }
      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error(`Not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Platform'],
  });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Baladi API')
    .setDescription(
      `## Municipal Issue Reporting System API

### Authentication
All endpoints except \`/auth/login\`, \`/auth/register\`, \`/auth/refresh\`, and \`/municipalities\` require JWT authentication.

### Response Format
All responses follow a standardized format:

**Success Response:**
\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": { ... } // only for paginated responses
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [...]
  },
  "timestamp": "2026-02-11T14:30:00.000Z",
  "path": "/endpoint"
}
\`\`\`

### Error Codes
- \`VALIDATION_ERROR\` - Request validation failed
- \`UNAUTHORIZED\` - Authentication required or invalid token
- \`FORBIDDEN\` - Insufficient permissions
- \`NOT_FOUND\` - Resource not found
- \`CONFLICT\` - Resource already exists
- \`TOO_MANY_REQUESTS\` - Rate limit exceeded
- \`INTERNAL_ERROR\` - Server error
`,
    )
    .setVersion('1.0.0')
    .setContact('Baladi Team', 'https://baladi.gov.lb', 'support@baladi.gov.lb')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'User authentication and registration')
    .addTag('Municipalities', 'Municipality information')
    .addTag('Departments', 'Department management')
    .addTag('Categories', 'Complaint category management')
    .addTag('Complaints', 'Complaint lifecycle management')
    .addTag('Users', 'User management (staff/workers)')
    .addTag('Roles', 'Role and permission management')
    .addTag('News', 'News and announcements')
    .addTag('Notifications', 'User notifications and device tokens')
    .build();

  // Only mount Swagger UI in non-production environments (or when explicitly enabled)
  const swaggerEnabled = !isProduction || process.env.ENABLE_SWAGGER === 'true';
  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: !isProduction,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'Baladi API Documentation',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0 }
        .swagger-ui .info .title { font-size: 2rem }
      `,
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs available at: http://localhost:${port}/api`);
  }
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
