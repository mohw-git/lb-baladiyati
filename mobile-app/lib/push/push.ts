/**
 * Mobile push (FCM) bootstrap.
 *
 * Flow:
 *   1. Caller invokes `registerPushNotifications()` after a successful
 *      login (or whenever the auth user changes).
 *   2. We ask the OS for notification permission.
 *   3. We fetch the device's FCM registration token via Expo's
 *      `getDevicePushTokenAsync()`. On Android this returns the raw FCM
 *      token; on iOS it returns the APNs token (firebase-admin handles
 *      both).
 *   4. We POST it to `/device-tokens` so the backend can target this
 *      device. The backend keeps multiple tokens per user (one per
 *      device).
 *   5. On logout, the caller invokes `unregisterPushNotifications()`
 *      which deletes the stored token and clears any local cache.
 *
 * The flow is best-effort: every step that can fail is wrapped so we
 * never block the auth flow.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { deviceTokensApi } from '../api/endpoints';

const STORAGE_KEY = 'baladi.fcmToken';

let cachedToken: string | null = null;

/** Set how foreground notifications should appear by default. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('baladi-default', {
      name: 'Baladi notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0c1a2e',
    });
  } catch {
    // Non-fatal — older Android versions may not support channels.
  }
}

async function requestPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    if (settings.canAskAgain) {
      const result = await Notifications.requestPermissionsAsync();
      return !!result.granted;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Register the current device for push notifications and ship the FCM
 * token to the backend so the platform can deliver pushes for the
 * signed-in user.
 *
 * Safe to call multiple times. Returns the token (if obtained).
 */
export async function registerPushNotifications(): Promise<string | null> {
  try {
    await ensureChannel();
    const granted = await requestPermission();
    if (!granted) return null;

    const result = await Notifications.getDevicePushTokenAsync();
    const token = typeof result?.data === 'string' ? result.data : null;
    if (!token) return null;

    if (cachedToken !== token) {
      const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
      try {
        await deviceTokensApi.register(token, platform);
      } catch (e) {
        // Don't bubble — it's OK if the network is down right now;
        // the next login will retry.
      }
      cachedToken = token;
    }
    return token;
  } catch (e) {
    return null;
  }
}

/**
 * Drop the registered FCM token from the backend (call on logout).
 */
export async function unregisterPushNotifications(): Promise<void> {
  if (!cachedToken) return;
  try {
    await deviceTokensApi.remove(cachedToken);
  } catch {
    // ignore
  }
  cachedToken = null;
}
