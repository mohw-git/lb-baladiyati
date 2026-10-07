import { get, post, patch, getPaginated } from '../client';
import { buildQueryString } from '@/lib/utils';
import type { Notification, NotificationQueryParams, UnreadCount } from '@shared/types/notification';

export const notificationsApi = {
  list: (params: NotificationQueryParams = {}) =>
    getPaginated<Notification>(`/notifications${buildQueryString(params as Record<string, unknown>)}`),

  unreadCount: async () => {
    const data = await get<UnreadCount & { count?: number }>('/notifications/unread-count');
    return {
      unreadCount: data.unreadCount ?? data.count ?? 0,
    };
  },

  markRead: (id: string) =>
    patch<Notification>(`/notifications/${id}/read`),

  markAllRead: () =>
    post<{ message: string; count: number }>('/notifications/read-all'),
};
