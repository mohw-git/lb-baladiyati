/**
 * Map notification payload to dashboard routes for click-through navigation.
 */
export function resolveNotificationRoute(
  type: string,
  data?: Record<string, unknown> | null,
): string | null {
  const payload = (data ?? {}) as Record<string, unknown>;
  const str = (key: string) => {
    const v = payload[key];
    if (v === null || v === undefined) return undefined;
    return String(v);
  };

  const complaintId = str('complaintId');
  const helpRequestId = str('helpRequestId');
  const targetType = str('targetType');
  const targetId = str('targetId');
  const newsId = str('newsId') ?? str('articleId');
  const taskId = str('taskId');
  const submissionId = str('submissionId');
  const deepLink = str('deepLink');

  if (type.startsWith('HELP_')) {
    if (helpRequestId) return `/help-requests/${helpRequestId}`;
    if (complaintId) return `/complaints/${complaintId}`;
  }

  if (type.startsWith('TRANSFER_')) {
    if (targetType === 'COMPLAINT' && targetId) return `/complaints/${targetId}`;
    if (complaintId) return `/complaints/${complaintId}`;
    return '/transfers';
  }

  if (type.startsWith('KYC_')) {
    if (type === 'KYC_SUBMITTED' && submissionId) {
      return `/kyc/${submissionId}`;
    }
    return '/kyc';
  }

  if (type.startsWith('NEWS_') && newsId) {
    return `/news/${newsId}`;
  }

  if (type.startsWith('TASK_')) {
    if (taskId) return `/tasks/${taskId}`;
    return '/tasks';
  }

  if (complaintId || type.startsWith('COMPLAINT_')) {
    if (complaintId) return `/complaints/${complaintId}`;
    return '/complaints';
  }

  if (type === 'PLATFORM_BROADCAST' || type.startsWith('PLATFORM_')) {
    if (deepLink?.startsWith('/')) return deepLink;
    return '/notifications';
  }

  if (deepLink?.startsWith('/')) {
    return deepLink;
  }

  return null;
}
