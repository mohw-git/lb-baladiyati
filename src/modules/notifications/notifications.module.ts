import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DeviceTokensController } from './device-tokens.controller';
import { NotificationsService } from './notifications.service';
import { NotificationRecipientsService } from './notification-recipients.service';

@Module({
  controllers: [NotificationsController, DeviceTokensController],
  providers: [NotificationsService, NotificationRecipientsService],
  exports: [NotificationsService, NotificationRecipientsService],
})
export class NotificationsModule {}
