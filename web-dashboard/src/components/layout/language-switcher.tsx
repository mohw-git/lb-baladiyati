'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Languages } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { SUPPORTED_LOCALES, useLocaleStore, useTranslate, type Locale } from '@/lib/i18n';

/**
 * Compact language picker. Lives in the topbar so it's reachable on every
 * page. Persists in two places:
 *  - `baladi-locale` (zustand persisted) — instant UI swap, no round-trip
 *  - the user's profile via PATCH /auth/me — so the next device sees it
 *
 * For unauthenticated visitors (login screen), only the local cache is updated.
 */
export function LanguageSwitcher() {
  const t = useTranslate();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const persistMutation = useMutation({
    mutationFn: (next: Locale) =>
      authApi.updateProfile({ locale: next.toUpperCase() as 'EN' | 'AR' | 'FR' }),
    onSuccess: (profile) => {
      // Only overwrite the user if the response carries the full role context.
      // Otherwise we risk losing isSuperAdmin and dropping the user into the
      // wrong panel. Defensive guard so partial backend responses are tolerated.
      if (profile && typeof (profile as any).isSuperAdmin === 'boolean') {
        setUser(profile);
      }
      // Refetch only locale-sensitive queries (translated DB content), not
      // session/auth/route-affecting ones, so language change preserves
      // current panel and route.
      queryClient.invalidateQueries({ queryKey: ['platform-branding'] });
      queryClient.invalidateQueries({ queryKey: ['public-platform-branding'] });
      queryClient.invalidateQueries({ queryKey: ['public-municipalities'] });
      queryClient.invalidateQueries({ queryKey: ['municipality', 'current'] });
      toast.success(t('profile.language.saved'));
    },
    onError: () => toast.error(t('profile.language.saveFailed')),
  });

  function onPick(next: Locale) {
    if (next === locale) return;
    // Always update local cache first — the UI swaps language instantly.
    // Server persistence is best-effort and never blocks navigation.
    setLocale(next);
    if (user) persistMutation.mutate(next);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        // The picker is a native <select> overlaid on the button so it works
        // everywhere (mobile, screen readers, keyboard) without a custom menu.
        aria-label={t('common.language')}
      >
        <Languages className="h-4 w-4" />
        <span className="uppercase">{locale}</span>
      </button>
      <select
        value={locale}
        onChange={(e) => onPick(e.target.value as Locale)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t('common.language')}
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {t((`lang.${loc}` as 'lang.en'))}
          </option>
        ))}
      </select>
    </div>
  );
}
