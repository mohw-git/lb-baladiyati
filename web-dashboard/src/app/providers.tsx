'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';

// Force auth store initialization (wires configureAuth)
import '@/lib/auth/store';
import { useLocaleSync, useLocale, isRtl } from '@/lib/i18n';

function LocaleSyncBridge() {
  useLocaleSync();
  return null;
}

function RtlAwareToaster() {
  const locale = useLocale();
  const rtl = isRtl(locale);
  return (
    <Toaster
      position={rtl ? 'top-left' : 'top-right'}
      richColors
      closeButton
      dir={rtl ? 'rtl' : 'ltr'}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchOnMount: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleSyncBridge />
      {children}
      <RtlAwareToaster />
    </QueryClientProvider>
  );
}
