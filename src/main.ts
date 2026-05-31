// Sentry MUST be imported first, before anything from the app, so its
// auto-instrumentation can patch Node modules at load time. The init is a
// no-op when SENTRY_DSN is unset.
import './instrument';
import * as Sentry from '@sentry/node';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { configureJsonBodyParsers } from './core/http/boundary-source-import-body.middleware';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from './core/common/interceptors/transform-response.interceptor';
import { assertProductionEnvOrExit } from './core/config/production-validator';
import { isCorsOriginAllowed, resolveCorsOrigins } from './core/config/cors-origins.util';

async function bootstrap() {
  // Fail-fast safety net: in production, refuse to start the app if any
  // env value is still a placeholder, points at localhost, or is unsafe.
  // In dev/test, this only logs warnings.
  assertProductionEnvOrExit();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(configureJsonBodyParsers);
  expressApp.use(express.urlencoded({ extended: true, limit: '100kb' }));
  // Swap default Nest logger for pino so internal Nest logs are also JSON.
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // Behind Caddy (or another reverse proxy) in production — honor X-Forwarded-* for req.ip / audits.
  if (isProduction) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

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

  // CORS — shared with Socket.IO via cors-origins.util (mobile: no Origin header → allowed).
  const corsOrigins = resolveCorsOrigins();
  if (isProduction && corsOrigins.length === 0) {
    logger.error(
      'CORS: no valid production origins. Set CORS_ORIGINS or FRONTEND_URL to a real https URL.',
    );
  }

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (isCorsOriginAllowed(origin)) {
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
    .setTitle('Baladiyati API')
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
    .setContact('Baladiyati Team', 'https://lb-baladiyati.com', 'support@lb-baladiyati.com')
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
      customSiteTitle: 'Baladiyati API Documentation',
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
