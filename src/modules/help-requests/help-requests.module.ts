import { Module } from '@nestjs/common';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsService } from './help-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ComplaintsModule } from '../complaints/complaints.module';

@Module({
  imports: [NotificationsModule, ComplaintsModule],
  controllers: [HelpRequestsController],
  providers: [HelpRequestsService],
  exports: [HelpRequestsService],
})
export class HelpRequestsModule {}
