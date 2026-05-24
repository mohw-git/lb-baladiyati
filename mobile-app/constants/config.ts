import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Priority order for API URL:
// 1. Build-time env (EXPO_PUBLIC_API_URL) - the canonical way to configure for production
// 2. Runtime extra config from app.json (extra.apiUrl)
// 3. Expo dev server hostUri (auto-detected for Expo Go on physical devices)
// 4. Platform-specific localhost fallback (Android emulator uses 10.0.2.2)

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const extraApiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];

function buildDevUrl(): string {
  const host = expoHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
  return `http://${host}:3000`;
}

export const API_URL: string =
  envApiUrl ||
  extraApiUrl ||
  (__DEV__ ? buildDevUrl() : '');

if (!API_URL) {
  // Don't crash but warn loudly - production builds MUST have EXPO_PUBLIC_API_URL set
  console.warn(
    '[config] No API URL configured. Set EXPO_PUBLIC_API_URL or app.json extra.apiUrl for production builds.',
  );
}
