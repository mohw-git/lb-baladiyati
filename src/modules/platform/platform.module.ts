import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAnnouncementsController } from './platform-announcements.controller';
import { PlatformAnnouncementsService } from './platform-announcements.service';
import { PlatformBoundaryService } from './platform-boundary.service';
import { PlatformBoundaryAssignmentController } from './platform-boundary-assignment.controller';
import { BoundarySourceImportService } from './boundary-source-import.service';
import { BoundaryAssignmentService } from './boundary-assignment.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformBroadcastsController } from './broadcast/platform-broadcasts.controller';
import { PlatformBroadcastsService } from './broadcast/platform-broadcasts.service';
import { PlatformBroadcastAudienceService } from './broadcast/platform-broadcast-audience.service';
import { PlatformBroadcastSchedulerService } from './broadcast/platform-broadcast-scheduler.service';

@Module({
  // MailModule is @Global() so MailService is available without an explicit import.
  imports: [
    ConfigModule,
    AuditModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [
    PlatformBoundaryAssignmentController,
    PlatformController,
    PlatformAnnouncementsController,
    PlatformBroadcastsController,
  ],
  providers: [
    PlatformService,
    PlatformAnnouncementsService,
    PlatformBoundaryService,
    BoundarySourceImportService,
    BoundaryAssignmentService,
    PlatformBroadcastsService,
    PlatformBroadcastAudienceService,
    PlatformBroadcastSchedulerService,
  ],
})
export class PlatformModule {}
