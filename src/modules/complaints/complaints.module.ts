import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { AssignmentsService } from './assignments.service';
import { StatusService } from './status.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { multerConfig } from '../../core/storage/multer.config';

@Module({
  imports: [
    MulterModule.register(multerConfig),
    NotificationsModule,
  ],
  controllers: [ComplaintsController],
  providers: [ComplaintsService, AssignmentsService, StatusService],
  exports: [ComplaintsService, AssignmentsService],
})
export class ComplaintsModule {}
