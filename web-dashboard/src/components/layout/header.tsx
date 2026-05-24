'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUserName } from '@/lib/auth';
import { isCitizenAccount } from '@/lib/auth/user';
import { useAuthStore } from '@/lib/auth/store';
import { notificationsApi, municipalitiesApi } from '@/lib/api';
import { authApi } from '@/lib/api/endpoints/auth';
import { Avatar } from '@/components/ui/avatar';
import { Bell, LogOut, User, ChevronDown, Building2 } from 'lucide-react';
import { LanguageSwitcher } from './language-switcher';
import { useTranslate, useLocale, pickName, systemRoleLabelKey } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';

export function Header() {
  const t = useTranslate();
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const { user, logout } = useAuth();
  const userName = useUserName();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      notificationsApi
        .unreadCount()
        .then((data) => setUnreadCount(data.unreadCount))
        .catch((err) => {
          if (err?.status && err.status !== 401) {
            console.warn('[notifications] Failed to fetch unread count:', err.message);
          }
        });
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      try { await authApi.logout(refreshToken); } catch {}
    }
    logout();
    router.replace('/login');
  };

  // Fetch municipality for localized name (skips for super-admin)
  const { data: muniData } = useQuery({
    queryKey: ['municipality', 'current'],
    queryFn: () => municipalitiesApi.getCurrent(),
    enabled: !!user?.municipalityId && !user?.isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  if (!user) return null;

  const showStaffRole = !isCitizenAccount(user);
  const firstRole = user.roles?.[0];
  const rawRoleName = typeof firstRole === 'string' ? firstRole : (firstRole as any)?.name || '';
  const sysRoleKey = rawRoleName ? systemRoleLabelKey(rawRoleName) : null;
  const roleName = showStaffRole ? (sysRoleKey ? t(sysRoleKey) : rawRoleName) : '';
  const municipalityName = muniData
    ? pickName(muniData as any, locale) || (user as any)?.municipality?.name
    : (user as any)?.municipality?.name || '';
  const impersonating =
    typeof window !== 'undefined' ? sessionStorage.getItem('impersonating') : null;

  return (
    <>
      {impersonating && (
        <div className="flex items-center justify-between border-b border-amber-300 bg-amber-50 px-6 py-2 text-sm text-amber-900">
          <span>
            <strong>{t('platform.users.btn.impersonate')}:</strong> {impersonating}
          </span>
          <button
            onClick={() => {
              sessionStorage.removeItem('impersonating');
              window.close();
            }}
            className="rounded border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium hover:bg-amber-200"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
        {/* Left: municipality context */}
        <div className="flex items-center gap-2 min-w-0">
          {municipalityName && (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="text-xs font-medium text-gray-600 truncate max-w-[200px]">
                {municipalityName}
              </span>
            </div>
          )}
        </div>

        {/* Right: actions — RTL-aware using flexbox (auto-reverses in dir=rtl) */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {/* Notifications bell */}
          <Link
            href="/notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('common.notifications')}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-alert-600 text-[9px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100"
            >
              <Avatar
                src={user.avatarUrl}
                firstName={user.firstName}
                lastName={user.lastName}
                size={28}
              />
              <div className="hidden text-start md:block">
                <p className="text-xs font-semibold text-gray-900 leading-tight">{userName}</p>
                {roleName && (
                  <p className="text-[10px] text-gray-500 capitalize leading-tight">{roleName}</p>
                )}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {showUserMenu && (
              <div
                className={`absolute top-full mt-1 w-52 rounded border border-gray-200 bg-white py-1 shadow-md z-50 ${
                  isRtl ? 'left-0' : 'right-0'
                }`}
              >
                <div className="border-b border-gray-100 px-4 py-2.5">
                  <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  {t('common.profile')}
                </Link>
                <div className="border-t border-gray-100">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-alert-600 hover:bg-red-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t('common.signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
