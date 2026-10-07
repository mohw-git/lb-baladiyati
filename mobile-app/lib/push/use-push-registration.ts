import { useEffect, useRef } from 'react';
import { canUseRemotePush } from './push-env';

/**
 * Register FCM after sign-in — dynamic import keeps expo-notifications out of Expo Go startup.
 */
export function usePushRegistration(userId: string | undefined) {
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !canUseRemotePush()) return;
    if (lastUserId.current === userId) return;
    lastUserId.current = userId;

    void import('./push-register').then(({ registerPushNotifications }) =>
      registerPushNotifications(userId),
    );
  }, [userId]);
}
