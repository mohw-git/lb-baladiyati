import { create } from 'zustand';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Locale, SUPPORTED_LOCALES, isRtl } from '@shared/types/locale';
import { translate, MessageKey } from './messages';

const STORAGE_KEY = 'baladi_locale';

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale, opts?: { persistOnly?: boolean }) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: 'en',
  hydrated: false,

  setLocale: async (locale, opts) => {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    set({ locale });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, locale);
    } catch {
      // SecureStore can fail in restricted contexts (e.g. web preview); fall back silently.
    }
    if (!opts?.persistOnly) {
      // Allow RTL layout. We *do not* call forceRTL here automatically because
      // RN requires an app restart for it to take effect. The language picker
      // surfaces a hint to the user when they switch to / from Arabic.
      I18nManager.allowRTL(true);
    }
  },

  hydrate: async () => {
    try {
      const saved = await SecureStore.getItemAsync(STORAGE_KEY);
      if (saved && SUPPORTED_LOCALES.includes(saved as Locale)) {
        set({ locale: saved as Locale });
      }
    } catch {
      // ignore
    } finally {
      set({ hydrated: true });
      I18nManager.allowRTL(true);
    }
  },
}));

/** React hook returning a translator function bound to the current locale. */
export function useTranslate() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
}

/** Convenience hook returning just the active locale. */
export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

/** Convenience hook returning whether the active locale is right-to-left. */
export function useIsRtl(): boolean {
  const locale = useLocale();
  return isRtl(locale);
}
