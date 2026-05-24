import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { imageOnlyMulterConfig } from '../../core/storage/multer.config';

@Module({
  imports: [MulterModule.register(imageOnlyMulterConfig), NotificationsModule],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
