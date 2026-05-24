import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { configureAuth } from '../api/client';
import { registerPushNotifications, unregisterPushNotifications } from '../push/push';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  verificationStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  municipalityId: string;
  municipality?: { id: string; name: string; nameAr?: string | null; nameFr?: string | null } | null;
  department?: { id: string; name: string; nameAr?: string | null; nameFr?: string | null } | null;
  locale?: 'EN' | 'AR' | 'FR';
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;

  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

const KEYS = {
  ACCESS_TOKEN: 'baladi_access_token',
  REFRESH_TOKEN: 'baladi_refresh_token',
  USER: 'baladi_user',
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    set({ user, accessToken, refreshToken, isLoading: false });
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
    void registerPushNotifications(user.id);
  },

  setTokens: async (accessToken, refreshToken) => {
    set({ accessToken, refreshToken });
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
  },

  setUser: async (user) => {
    set({ user });
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
  },

  updateUser: async (partial) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...partial };
    set({ user: updated });
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(updated));
  },

  logout: async () => {
    await unregisterPushNotifications();
    set({ user: null, accessToken: null, refreshToken: null });
    await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.USER);
  },

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(KEYS.USER),
      ]);
      if (accessToken && refreshToken && userJson) {
        const user = JSON.parse(userJson);
        set({ user, accessToken, refreshToken, isLoading: false });
        void registerPushNotifications(user.id);
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));

// Wire API client to auth store
configureAuth(
  () => useAuthStore.getState().accessToken,
  () => useAuthStore.getState().refreshToken,
  (access, refresh) => useAuthStore.getState().setTokens(access, refresh),
  () => useAuthStore.getState().logout(),
);
