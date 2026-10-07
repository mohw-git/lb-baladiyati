import { CreatePlatformAnnouncementDto } from './create-platform-announcement.dto';

export class UpdatePlatformAnnouncementDto implements Partial<CreatePlatformAnnouncementDto> {
  title?: string;
  titleAr?: string;
  titleFr?: string;
  summary?: string;
  summaryAr?: string;
  summaryFr?: string;
  content?: string;
  contentAr?: string;
  contentFr?: string;
  isPinned?: boolean;
  priority?: number;
  publishAt?: string;
  expiresAt?: string;
}
