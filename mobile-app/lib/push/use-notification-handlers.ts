import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/store';
import { resolveNotificationHref, type NotificationPayload } from './notification-routing';
import { canUseRemotePush } from './push-env';

function payloadFromData(data: Record<string, unknown> | undefined): NotificationPayload {
  return {
    type: typeof data?.type === 'string' ? data.type : undefined,
    data: data ?? {},
  };
}

function notificationTypeFromData(data: Record<string, unknown> | undefined): string | undefined {
  return typeof data?.type === 'string' ? data.type : undefined;
}

function invalidateOnNotification(queryClient: QueryClient, notificationType?: string) {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['unread-count'] });
  queryClient.invalidateQueries({ queryKey: ['complaint'] });
  queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
  queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
  queryClient.invalidateQueries({ queryKey: ['help-requests'] });
  queryClient.invalidateQueries({ queryKey: ['helpRequests'] });
  queryClient.invalidateQueries({ queryKey: ['transfers'] });

  if (notificationType?.startsWith('NEWS_')) {
    queryClient.invalidateQueries({ queryKey: ['news'] });
  }

  if (notificationType?.startsWith('KYC_')) {
    queryClient.invalidateQueries({ queryKey: ['kycStatus'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  }
}

export function useNotificationHandlers(queryClient: QueryClient) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (!userId || !canUseRemotePush()) return;

    let cancelled = false;
    let receivedSub: { remove: () => void } | undefined;
    let responseSub: { remove: () => void } | undefined;

    const navigate = (payload: NotificationPayload) => {
      const href = resolveNotificationHref(payload);
      if (href) router.push(href);
      else router.push('/notifications');
    };

    void (async () => {
      const Notifications = await import('expo-notifications');
      if (cancelled) return;

      if (!handledColdStart.current) {
        handledColdStart.current = true;
        try {
          const response = await Notifications.getLastNotificationResponseAsync();
          if (response && !cancelled) {
            const data = response.notification.request.content.data as
              | Record<string, unknown>
              | undefined;
            const type = notificationTypeFromData(data);
            invalidateOnNotification(queryClient, type);
            navigate(payloadFromData(data));
          }
        } catch {
          // ignore
        }
      }

      receivedSub = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined;
        invalidateOnNotification(queryClient, notificationTypeFromData(data));
      });

      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const type = notificationTypeFromData(data);
        invalidateOnNotification(queryClient, type);
        navigate(payloadFromData(data));
      });
    })();

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, [userId, queryClient, router]);
}
