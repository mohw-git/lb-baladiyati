import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAnnouncementsController } from './platform-announcements.controller';
import { PlatformAnnouncementsService } from './platform-announcements.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  // MailModule is @Global() so MailService is available without an explicit import.
  imports: [
    ConfigModule,
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [PlatformController, PlatformAnnouncementsController],
  providers: [PlatformService, PlatformAnnouncementsService],
})
export class PlatformModule {}
