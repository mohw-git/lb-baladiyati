'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuthGuard, useAuthStore } from '@/lib/auth';
import { RealtimeProvider } from '@/lib/realtime/provider';
import { cn } from '@/lib/utils';
import { isRtl, useLocale } from '@/lib/i18n';
import { UnverifiedEmailBanner } from '@/components/auth/unverified-email-banner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Per page-load dismiss state. Verification status is re-evaluated on
  // every full reload, so a soft dismiss is enough to keep operators from
  // staring at the banner while they finish a task.
  const [unverifiedDismissed, setUnverifiedDismissed] = useState(false);
  const locale = useLocale();
  const rtl = isRtl(locale);
  const user = useAuthStore((s) => s.user);

  // A user is considered "unverified" only when the backend explicitly
  // says so (emailVerified === false). We avoid showing the banner during
  // the brief window where the store has hydrated but the profile hasn't
  // been refreshed yet (both fields undefined).
  const showUnverifiedBanner =
    !!user &&
    !unverifiedDismissed &&
    user.emailVerified === false;

  return (
    <AuthGuard>
      <RealtimeProvider>
        {/* Government body background — light gray work surface */}
        <div className="min-h-screen bg-gray-100">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Main content shifts based on sidebar width and text direction */}
          <div
            className={cn(
              'flex flex-col transition-all duration-300',
              // In RTL, <html dir="rtl"> flips start/end, so sidebar is on the right.
              // Margin must be on the right side to clear the sidebar.
              sidebarCollapsed
                ? rtl ? 'mr-14' : 'ml-14'
                : rtl ? 'mr-60' : 'ml-60',
            )}
          >
            <Header />
            {/* Dense operational padding — less whitespace than SaaS default */}
            <main className="flex-1 p-4 md:p-5">
              {showUnverifiedBanner && user && (
                <div className="mb-4">
                  <UnverifiedEmailBanner
                    email={user.email}
                    variant="page"
                    onDismiss={() => setUnverifiedDismissed(true)}
                  />
                </div>
              )}
              {children}
            </main>
          </div>
        </div>
      </RealtimeProvider>
    </AuthGuard>
  );
}
