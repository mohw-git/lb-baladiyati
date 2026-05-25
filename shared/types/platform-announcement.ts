export type PlatformAnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface PlatformAnnouncementAuthor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  titleAr?: string | null;
  titleFr?: string | null;
  summary: string;
  summaryAr?: string | null;
  summaryFr?: string | null;
  content: string;
  contentAr?: string | null;
  contentFr?: string | null;
  imageUrl?: string | null;
  status: PlatformAnnouncementStatus;
  isPinned: boolean;
  priority: number;
  publishAt?: string | null;
  expiresAt?: string | null;
  createdById: string;
  createdBy?: PlatformAnnouncementAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformAnnouncementRequest {
  title: string;
  titleAr?: string;
  titleFr?: string;
  summary: string;
  summaryAr?: string;
  summaryFr?: string;
  content: string;
  contentAr?: string;
  contentFr?: string;
  isPinned?: boolean;
  priority?: number;
  publishAt?: string;
  expiresAt?: string;
}

export interface UpdatePlatformAnnouncementRequest extends Partial<CreatePlatformAnnouncementRequest> {}

export interface PlatformAnnouncementQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: PlatformAnnouncementStatus;
  expired?: boolean;
}
