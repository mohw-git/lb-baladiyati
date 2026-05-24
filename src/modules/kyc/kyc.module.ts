import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { KycController } from './kyc.controller';
import { KycAdminController } from './kyc-admin.controller';
import { KycService } from './kyc.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    NotificationsModule,
  ],
  controllers: [KycController, KycAdminController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
