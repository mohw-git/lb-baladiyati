/**
 * Mobile push (FCM) bootstrap.
 *
 * Invoked from the auth store after login, register, or session restore.
 * On logout, unregister removes the token from the backend while JWT is
 * still valid, then clears local state.
 */
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { deviceTokensApi } from '../api/endpoints';

const STORAGE_KEY = 'baladi.fcmToken';
const REGISTERED_USER_KEY = 'baladi.fcmRegisteredUserId';

let cachedToken: string | null = null;
let cachedUserId: string | null = null;
let registerInFlight: Promise<string | null> | null = null;

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

async function loadPersistedState(): Promise<{ token: string | null; userId: string | null }> {
  try {
    const [token, userId] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEY),
      SecureStore.getItemAsync(REGISTERED_USER_KEY),
    ]);
    return { token, userId };
  } catch {
    return { token: null, userId: null };
  }
}

async function persistRegisteredState(token: string, userId: string) {
  cachedToken = token;
  cachedUserId = userId;
  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEY, token),
    SecureStore.setItemAsync(REGISTERED_USER_KEY, userId),
  ]);
}

async function clearRegisteredState() {
  cachedToken = null;
  cachedUserId = null;
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEY),
    SecureStore.deleteItemAsync(REGISTERED_USER_KEY),
  ]);
}

async function resolveTokenForUnregister(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const { token } = await loadPersistedState();
  if (token) cachedToken = token;
  return token;
}

async function doRegister(userId: string): Promise<string | null> {
  try {
    await ensureChannel();
    const granted = await requestPermission();
    if (!granted) return null;

    const result = await Notifications.getDevicePushTokenAsync();
    const token = typeof result?.data === 'string' ? result.data : null;
    if (!token) return null;

    const persisted = await loadPersistedState();
    const alreadyRegistered =
      token === (cachedToken ?? persisted.token) &&
      userId === (cachedUserId ?? persisted.userId);

    if (alreadyRegistered) {
      cachedToken = token;
      cachedUserId = userId;
      return token;
    }

    const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    try {
      await deviceTokensApi.register(token, platform);
      await persistRegisteredState(token, userId);
    } catch {
      // Network/backend failure — don't block auth; retry on next session.
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Register this device for push notifications and associate the FCM token
 * with the signed-in user on the backend.
 *
 * Safe to call multiple times; skips duplicate backend registration when
 * the same user already registered the same token. Returns null when
 * permission is denied or the token cannot be obtained.
 */
export async function registerPushNotifications(userId: string): Promise<string | null> {
  if (!userId) return null;
  if (registerInFlight) return registerInFlight;

  registerInFlight = doRegister(userId).finally(() => {
    registerInFlight = null;
  });

  return registerInFlight;
}

/**
 * Remove the device token from the backend (call before clearing auth).
 * Best-effort when the session is already invalid.
 */
export async function unregisterPushNotifications(): Promise<void> {
  const token = await resolveTokenForUnregister();
  if (!token) {
    await clearRegisteredState();
    return;
  }

  try {
    await deviceTokensApi.remove(token);
  } catch {
    // Session may already be expired — still clear local state.
  }

  await clearRegisteredState();
}
