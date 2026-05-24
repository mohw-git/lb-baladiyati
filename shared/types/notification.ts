// ============================================================
// Notification types
// ============================================================

export type NotificationType =
  | 'COMPLAINT_ASSIGNED'
  | 'COMPLAINT_STATUS_CHANGED'
  | 'COMPLAINT_COMPLETED'
  | 'NEWS_PUBLISHED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

export interface UnreadCount {
  unreadCount: number;
}
