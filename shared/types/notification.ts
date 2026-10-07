// ============================================================
// Notification types (mirror prisma NotificationType enum)
// ============================================================

export type NotificationType =
  | 'COMPLAINT_SUBMITTED'
  | 'COMPLAINT_ASSIGNED'
  | 'COMPLAINT_STATUS_CHANGED'
  | 'COMPLAINT_COMPLETED'
  | 'COMPLAINT_REJECTED'
  | 'COMPLAINT_ESCALATED'
  | 'COMPLAINT_FEEDBACK_REQUESTED'
  | 'NEWS_PUBLISHED'
  | 'KYC_SUBMITTED'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TRANSFER_REQUESTED'
  | 'TRANSFER_ACCEPTED'
  | 'TRANSFER_REJECTED'
  | 'HELP_REQUESTED'
  | 'HELP_ACCEPTED'
  | 'HELP_DECLINED'
  | 'HELP_ASSIGNED'
  | 'HELP_SUBMITTED'
  | 'HELP_COMPLETED'
  | 'HELP_REJECTED'
  | 'HELP_CANCELLED'
  | 'PLATFORM_BROADCAST';

/** Distinguishes the two HELP_REJECTED flows without a schema enum change. */
export type HelpRejectPhase = 'SOURCE' | 'HELPER_WORK';

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
