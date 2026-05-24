import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useAuthStore } from '../lib/auth/store';
import { authApi } from '../lib/api/endpoints';
import { useRealtime } from '../lib/realtime/useRealtime';
import { initSentry } from '../lib/sentry';
import { useLocaleStore } from '../lib/i18n';
import { Locale, SUPPORTED_LOCALES, toApiLocale } from '@shared/types/locale';

// Initialise Sentry as early as possible — before any other module work runs.
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      // Auto refetch when app comes back to foreground (real-time feel)
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

// Wire React Native AppState to React Query's focusManager so queries refetch
// when the user backgrounds + foregrounds the app.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const setLocale = useLocaleStore((s) => s.setLocale);

  // Stream backend updates straight into React Query so changes appear without
  // pull-to-refresh or interval polling.
  useRealtime(queryClient);

  useEffect(() => {
    hydrate();
    hydrateLocale();
  }, []);

  // AppState focus -> React Query focus
  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  // Refresh profile every 60s + on app foreground so KYC/role updates appear live
  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = () => {
      authApi
        .getProfile()
        .then((u: any) => {
          setUser(u);
          // Server is source of truth for the user's preferred language; only
          // adopt valid values from `UserLocale` (EN | AR | FR).
          // Server returns the Prisma enum (EN | AR | FR); normalise to the
          // lowercase IETF tag we use on the client.
          if (u?.locale) {
            const clientLocale = toApiLocale(u.locale) as Locale;
            if (SUPPORTED_LOCALES.includes(clientLocale)) {
              setLocale(clientLocale, { persistOnly: true });
            }
          }
        })
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [isAuthenticated, setUser, setLocale]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="complaint/[id]" options={{ headerShown: true, title: 'Complaint Details', headerBackTitle: 'Back' }} />
        <Stack.Screen name="news/[id]" options={{ headerShown: true, title: 'News Article', headerBackTitle: 'Back' }} />
        <Stack.Screen name="language" options={{ headerShown: false }} />
        <Stack.Screen name="kyc" options={{ headerShown: true, title: 'Identity Verification', headerBackTitle: 'Back' }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications', headerBackTitle: 'Back' }} />
        <Stack.Screen name="enroll-2fa" options={{ headerShown: true, title: 'Two-Factor Setup', headerBackTitle: 'Back' }} />
      </Stack>
    </QueryClientProvider>
  );
}
