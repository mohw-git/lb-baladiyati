import { get, post, patch, getPaginated } from '../client';
import { buildQueryString } from '@/lib/utils';
import type { Notification, NotificationQueryParams, UnreadCount } from '@shared/types/notification';

export const notificationsApi = {
  list: (params: NotificationQueryParams = {}) =>
    getPaginated<Notification>(`/notifications${buildQueryString(params as Record<string, unknown>)}`),

  unreadCount: () =>
    get<UnreadCount>('/notifications/unread-count'),

  markRead: (id: string) =>
    patch<Notification>(`/notifications/${id}/read`),

  markAllRead: () =>
    post<{ message: string; count: number }>('/notifications/read-all'),
};
