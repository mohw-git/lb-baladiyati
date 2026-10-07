import { Module } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ComplaintsModule } from '../complaints/complaints.module';

@Module({
  imports: [NotificationsModule, ComplaintsModule],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
