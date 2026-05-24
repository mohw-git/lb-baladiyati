import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DeviceTokensController } from './device-tokens.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, DeviceTokensController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
