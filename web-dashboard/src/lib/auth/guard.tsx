'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './hooks';
import { useAuthStore } from './store';
import { authApi } from '@/lib/api';
import { isCitizenAccount } from './user';

/** Routes unverified-email citizens may use when platform policy allows complaint submission. */
const LIMITED_CITIZEN_PREFIXES = [
  '/profile',
  '/complaints',
  '/kyc/submit',
  '/notifications',
];

interface AuthGuardProps {
  children: React.ReactNode;
  permissions?: string[];
}

/**
 * Protects routes that require authentication.
 * Optionally checks for specific permissions.
 * Automatically refreshes permissions from server on route changes.
 */
export function AuthGuard({ children, permissions }: AuthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const pathname = usePathname();
  const hasRefreshed = useRef(false);
  // Tracks whether we've reconciled the auth store with a fresh /profile fetch
  // since this guard mounted. We only allow gate-keeping redirects (mustChangePassword,
  // mustEnrollTwoFactor) AFTER reconciliation, so a stale flag from a previous session
  // (e.g. after the Super Admin toggled off "Require 2FA for staff") doesn't trap users.
  const [profileReconciled, setProfileReconciled] = useState(false);

  // Refresh user profile (including permissions) on mount and route changes
  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasRefreshed.current) {
      hasRefreshed.current = true;

      authApi.getProfile()
        .then((freshProfile) => {
          setUser(freshProfile);
          setProfileReconciled(true);
        })
        .catch((err) => {
          console.error('Failed to refresh profile:', err);
          // Even on failure, unblock so the user isn't permanently stuck
          setProfileReconciled(true);
        });
    }
  }, [isLoading, isAuthenticated, setUser]);

  // Reset on pathname changes so we always reconcile against the latest server
  // state before applying gate-keeping redirects.
  useEffect(() => {
    hasRefreshed.current = false;
    setProfileReconciled(false);
  }, [pathname]);

  // Periodic background refresh of the profile (so KYC verification, role/permission
  // changes, etc. appear without forcing the user to sign out and in again).
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      authApi.getProfile().then(setUser).catch(() => {});
    }, 60_000); // every 60 s
    return () => clearInterval(id);
  }, [isAuthenticated, setUser]);

  // Refresh on tab focus (cheap and very effective for "feels live")
  useEffect(() => {
    if (!isAuthenticated) return;
    const onFocus = () => {
      authApi.getProfile().then(setUser).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isAuthenticated, setUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Super admins should never land on tenant pages — redirect to /platform
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.isSuperAdmin) {
      const isTenantPath =
        pathname === '/dashboard' ||
        (!pathname.startsWith('/platform') &&
          !pathname.startsWith('/profile') &&
          !pathname.startsWith('/impersonate'));
      if (isTenantPath) {
        router.replace('/platform');
      }
    }
  }, [isLoading, isAuthenticated, user?.isSuperAdmin, pathname, router]);

  // If a platform admin force-reset this user's password, send them to /profile
  // so they're forced to change it before doing anything else.
  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      profileReconciled &&
      (user as any)?.mustChangePassword &&
      pathname !== '/profile'
    ) {
      router.replace('/profile?forceChangePassword=1');
    }
  }, [isLoading, isAuthenticated, profileReconciled, user, pathname, router]);

  // Unverified-email citizens with allowUnverifiedCitizenComplaints may only
  // access complaint submission, profile/KYC, and notifications — not the full dashboard.
  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      profileReconciled &&
      user &&
      isCitizenAccount(user) &&
      user.emailVerified === false &&
      user.allowUnverifiedCitizenComplaints === true
    ) {
      const allowed = LIMITED_CITIZEN_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      if (!allowed) {
        router.replace('/complaints/new');
      }
    }
  }, [
    isLoading,
    isAuthenticated,
    profileReconciled,
    user,
    pathname,
    router,
  ]);

  // If the Super Admin enabled platform-wide "Require 2FA for staff" and this
  // user has not yet enrolled, force them through the 2FA setup flow on
  // /profile before they can do anything else. Gated on profileReconciled so
  // that toggling the platform setting OFF takes effect on the next route
  // change instead of being trapped by the stale Zustand value.
  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      profileReconciled &&
      (user as any)?.mustEnrollTwoFactor &&
      pathname !== '/profile'
    ) {
      router.replace('/profile?force2fa=1');
    }
  }, [isLoading, isAuthenticated, profileReconciled, user, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Check permissions if specified
  if (permissions && permissions.length > 0 && user) {
    const hasPermission = permissions.some((p) => user.permissions?.includes(p));
    if (!hasPermission) {
      return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <div className="text-6xl">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-500">You don&apos;t have permission to access this page.</p>
          <button
            onClick={() => router.back()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
          >
            Go Back
          </button>
        </div>
      );
    }
  }

  return <>{children}</>;
}
