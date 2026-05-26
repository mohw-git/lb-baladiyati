import type { Href } from 'expo-router';

export type NotificationPayload = {
  type?: string;
  data?: Record<string, unknown> | null;
};

function str(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key];
  if (v === null || v === undefined) return undefined;
  return String(v);
}

/**
 * Resolve an in-app route from push or in-app notification payload.
 * Backend FCM data includes `type` plus entity ids (complaintId, helpRequestId, …).
 */
export function resolveNotificationHref(payload: NotificationPayload): Href | null {
  const type = String(payload.type ?? '');
  const data = (payload.data ?? {}) as Record<string, unknown>;

  const complaintId = str(data, 'complaintId');
  const helpRequestId = str(data, 'helpRequestId');
  const targetType = str(data, 'targetType');
  const targetId = str(data, 'targetId');
  const newsId = str(data, 'newsId') ?? str(data, 'articleId');

  if (complaintId) {
    return `/complaint/${complaintId}` as Href;
  }

  if (helpRequestId || type.startsWith('HELP_')) {
    if (helpRequestId) return `/help-request/${helpRequestId}` as Href;
    return '/(tabs)/inbox' as Href;
  }

  if (type.startsWith('TRANSFER_')) {
    if (targetType === 'COMPLAINT' && targetId) {
      return `/complaint/${targetId}` as Href;
    }
    return '/(tabs)/inbox' as Href;
  }

  if (type.startsWith('KYC_')) {
    return '/kyc' as Href;
  }

  if (type.startsWith('NEWS_') && newsId) {
    return `/news/${newsId}` as Href;
  }

  if (type.startsWith('TASK_')) {
    return '/(tabs)/tasks' as Href;
  }

  if (type.startsWith('COMPLAINT_')) {
    return complaintId ? (`/complaint/${complaintId}` as Href) : ('/(tabs)/complaints' as Href);
  }

  return null;
}
