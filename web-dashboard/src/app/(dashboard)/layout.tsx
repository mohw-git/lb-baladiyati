'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuthGuard, useAuthStore } from '@/lib/auth';
import { RealtimeProvider } from '@/lib/realtime/provider';
import { cn } from '@/lib/utils';
import { UnverifiedEmailBanner } from '@/components/auth/unverified-email-banner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unverifiedDismissed, setUnverifiedDismissed] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const showUnverifiedBanner =
    !!user &&
    !unverifiedDismissed &&
    user.emailVerified === false;

  return (
    <AuthGuard>
      <RealtimeProvider>
        <div className="min-h-screen bg-gray-100">
          {mobileNavOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-30 bg-navy-950/60 lg:hidden"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            />
          ) : null}

          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
          />

          <div
            className={cn(
              // Sidebar is `fixed start-0` — always offset on the inline-start side (left in LTR, right in RTL).
              'flex min-h-screen min-w-0 flex-col transition-all duration-300 max-lg:ms-0',
              sidebarCollapsed ? 'lg:ms-14' : 'lg:ms-60',
            )}
          >
            <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
            <main className="flex-1 overflow-x-hidden p-4 md:p-5">
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
