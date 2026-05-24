import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { join } from 'path';

// Core modules
import { ConfigModule } from './core/config/config.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthCoreModule } from './core/auth/auth.module';
import { RbacModule } from './core/rbac/rbac.module';
import { StorageModule } from './core/storage/storage.module';
import { FcmModule } from './core/fcm/fcm.module';
import { MailModule } from './core/mail/mail.module';
import { RealtimeModule } from './core/realtime/realtime.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { MunicipalitiesModule } from './modules/municipalities/municipalities.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { NewsModule } from './modules/news/news.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { KycModule } from './modules/kyc/kyc.module';
import { AuditModule } from './modules/audit/audit.module';
import { PlatformModule } from './modules/platform/platform.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { HelpRequestsModule } from './modules/help-requests/help-requests.module';
import { HealthModule } from './modules/health/health.module';

// Guards
import { JwtAuthGuard } from './core/auth/jwt-auth.guard';
import { PermissionsGuard } from './core/rbac/permissions.guard';
import { WebOnlyGuard } from './core/auth/guards/web-only.guard';
import { MaintenanceGuard } from './core/maintenance/maintenance.guard';

@Module({
  imports: [
    // Structured JSON logging via pino. In dev we pretty-print for readability;
    // in production logs go to stdout as single-line JSON ready for ingestion
    // by Datadog / Loki / CloudWatch.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        // Generate a request-id for every incoming HTTP request (or honor an
        // existing one) so logs from a single request can be correlated.
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id = typeof existing === 'string' && existing ? existing : randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // Don't write a log line for liveness/readiness pings — they pollute logs.
        autoLogging: {
          ignore: (req) => {
            const url = req.url ?? '';
            return url === '/health' || url === '/ready' || url === '/version';
          },
        },
        // Strip authorization headers and cookies before they hit the log stream.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-forwarded-for"]',
            'res.headers["set-cookie"]',
          ],
          censor: '[redacted]',
        },
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'HH:MM:ss.l',
                  ignore: 'pid,hostname,req.headers,res.headers,responseTime',
                },
              },
      },
    }),

    // Serve static files (uploads)
    // Use process.cwd() (project root) because __dirname points to dist/src/ after compilation
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false, // Don't try to serve index.html as fallback
      },
    }),

    // Rate limiting - default 100 requests per minute
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Core modules
    ConfigModule,
    PrismaModule,
    AuthCoreModule,
    RbacModule,
    StorageModule,
    FcmModule,
    MailModule,
    RealtimeModule,

    // Feature modules
    AuthModule,
    MunicipalitiesModule,
    DepartmentsModule,
    RolesModule,
    UsersModule,
    CategoriesModule,
    ComplaintsModule,
    NewsModule,
    NotificationsModule,
    KycModule,
    AuditModule,
    PlatformModule,
    TasksModule,
    TransfersModule,
    HelpRequestsModule,
    HealthModule,
  ],
  providers: [
    // Global Throttler Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global JWT Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Permissions Guard
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    // Global Web-Only Guard (rejects mobile-app requests on @WebOnly endpoints)
    {
      provide: APP_GUARD,
      useClass: WebOnlyGuard,
    },
    // Global Maintenance Guard (blocks non-super-admin traffic when maintenance mode is on)
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
  ],
})
export class AppModule {}
