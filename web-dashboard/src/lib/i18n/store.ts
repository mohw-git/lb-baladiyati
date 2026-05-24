'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LOCALE, isLocale, isRtl, type Locale } from '@shared/types/locale';
import { translate, type MessageKey } from './messages';
import { useAuthStore } from '@/lib/auth';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Hard-overwrite from the server profile (used right after login). */
  syncFromServer: (serverLocale: string | undefined | null) => void;
}

/**
 * Locale lives in its own persisted store so the dashboard can render with the
 * user's last-picked language before the auth profile has hydrated.
 * The auth store is the source of truth on the server; this is just a UI
 * cache. The two are reconciled by `useLocaleSync`.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
      syncFromServer: (serverLocale) => {
        if (!serverLocale) return;
        const lower = serverLocale.toLowerCase();
        if (isLocale(lower)) set({ locale: lower });
      },
    }),
    { name: 'baladi-locale' },
  ),
);

/** Stable callable hook — keeps `t` referentially stable per-locale change. */
export function useTranslate() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
}

export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

/**
 * Mount this once at the top of the app. Two responsibilities:
 *  1. On every locale change, push the value to <html lang/dir> so CSS and
 *     screen readers see RTL correctly.
 *  2. When the user logs in, hard-overwrite the local choice with whatever
 *     the server has stored (so a different device sees the same language).
 */
export function useLocaleSync() {
  const locale = useLocaleStore((s) => s.locale);
  const syncFromServer = useLocaleStore((s) => s.syncFromServer);
  const userLocale = useAuthStore((s) => s.user?.locale);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    if (userLocale) syncFromServer(userLocale);
  }, [userLocale, syncFromServer]);
}
