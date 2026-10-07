/**
 * Push token registration — loaded only via dynamic import() after auth.
 * Must not be imported statically from auth screens or store.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { deviceTokensApi } from '../api/endpoints';
import { canUseRemotePush } from './push-env';

const STORAGE_KEY = 'baladi.fcmToken';
const REGISTERED_USER_KEY = 'baladi.fcmRegisteredUserId';

let cachedToken: string | null = null;
let cachedUserId: string | null = null;
let registerInFlight: Promise<string | null> | null = null;
let handlerConfigured = false;

async function loadNotificationsModule() {
  if (!canUseRemotePush()) return null;
  return import('expo-notifications');
}

async function ensureForegroundHandler(
  Notifications: Awaited<ReturnType<typeof loadNotificationsModule>>,
) {
  if (!Notifications || handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureChannel(Notifications: NonNullable<Awaited<ReturnType<typeof loadNotificationsModule>>>) {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('baladi-default', {
      name: 'Baladiyati notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0c1a2e',
    });
  } catch {
    // Non-fatal
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

async function doRegister(userId: string): Promise<string | null> {
  if (!canUseRemotePush()) return null;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return null;

  try {
    await ensureForegroundHandler(Notifications);
    await ensureChannel(Notifications);

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      const result = await Notifications.requestPermissionsAsync();
      granted = !!result.granted;
    }
    if (!granted) return null;

    const result = await Notifications.getDevicePushTokenAsync();
    const token = typeof result?.data === 'string' ? result.data : null;
    if (!token) return null;

    const persisted = await loadPersistedState();
    if (
      token === (cachedToken ?? persisted.token) &&
      userId === (cachedUserId ?? persisted.userId)
    ) {
      cachedToken = token;
      cachedUserId = userId;
      return token;
    }

    const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    try {
      await deviceTokensApi.register(token, platform);
      await persistRegisteredState(token, userId);
    } catch {
      // Retry on next session
    }
    return token;
  } catch {
    return null;
  }
}

export async function registerPushNotifications(userId: string): Promise<string | null> {
  if (!userId || !canUseRemotePush()) return null;
  if (registerInFlight) return registerInFlight;
  registerInFlight = doRegister(userId).finally(() => {
    registerInFlight = null;
  });
  return registerInFlight;
}

export async function unregisterPushNotifications(): Promise<void> {
  const token =
    cachedToken ?? (await loadPersistedState()).token;
  if (!token) {
    await clearRegisteredState();
    return;
  }
  try {
    await deviceTokensApi.remove(token);
  } catch {
    // Session may be expired
  }
  await clearRegisteredState();
}
