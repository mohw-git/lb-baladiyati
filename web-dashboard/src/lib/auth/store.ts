'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUserWithRoles } from '@shared/types/auth';
import { configureAuth } from '@/lib/api/client';
import { mergeAuthProfile } from './user';

interface AuthState {
  user: AuthUserWithRoles | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;

  // Actions
  setAuth: (user: AuthUserWithRoles, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUserWithRoles) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user: mergeAuthProfile(null, user), accessToken, refreshToken }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) =>
        set((state) => ({ user: mergeAuthProfile(state.user, user) })),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null }),

      setHydrated: () =>
        set({ isHydrated: true }),
    }),
    {
      name: 'baladi-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

// Wire up API client with auth store
if (typeof window !== 'undefined') {
  configureAuth(
    () => useAuthStore.getState().accessToken,
    () => useAuthStore.getState().refreshToken,
    (access, refresh) => useAuthStore.getState().setTokens(access, refresh),
    () => useAuthStore.getState().logout(),
  );
}
