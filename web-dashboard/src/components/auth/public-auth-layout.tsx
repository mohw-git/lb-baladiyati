'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/api/endpoints/platform';
import { PublicHeroBackground } from '@/components/brand/public-hero-background';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useTranslate, useLocale, isRtl } from '@/lib/i18n';
import { resolveBrandMediaUrl } from '@/lib/municipality-branding';
import { resolveAuthPageBackground } from '@/lib/platform-branding';
import { cn } from '@/lib/utils';
import {
  Building2,
  ChevronLeft,
  ClipboardList,
  Home,
  Phone,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export type PublicAuthVariant = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

type PublicAuthLayoutProps = {
  variant: PublicAuthVariant;
  children: ReactNode;
  /** Extra content below the card (e.g. register link). */
  belowCard?: ReactNode;
  /** Wider card on desktop (register). */
  wideCard?: boolean;
};

function localizedPlatformName(
  branding: { platformName?: string | null; platformNameAr?: string | null; platformNameFr?: string | null } | undefined,
  locale: string,
  fallback: string,
): string {
  if (!branding) return fallback;
  if (locale === 'ar') return branding.platformNameAr || branding.platformName || fallback;
  if (locale === 'fr') return branding.platformNameFr || branding.platformName || fallback;
  return branding.platformName || fallback;
}

export function PublicAuthLayout({
  variant,
  children,
  belowCard,
  wideCard,
}: PublicAuthLayoutProps) {
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);

  const { data: branding } = useQuery({
    queryKey: ['public-platform-branding'],
    queryFn: () => platformApi.getBranding(),
    staleTime: 10 * 60 * 1000,
  });

  const platformName = localizedPlatformName(branding, locale, t('common.appName'));
  const logoUrl = resolveBrandMediaUrl(branding?.logoUrl);
  const supportPhone = branding?.supportPhone;
  const supportEmail = branding?.supportEmail;

  const welcomeTitle =
    variant === 'register'
      ? t('auth.shell.welcomeRegister', { platform: platformName })
      : t('auth.shell.welcomeLogin', { platform: platformName });

  const welcomeDesc =
    variant === 'register' ? t('auth.shell.descRegister') : t('auth.shell.descLogin');

  const benefits = [
    { icon: Building2, text: t('auth.shell.benefitPortal') },
    { icon: ShieldCheck, text: t('auth.shell.benefitSecure') },
    { icon: ClipboardList, text: t('auth.shell.benefitTrack') },
  ];

  const authBg = resolveAuthPageBackground(branding);

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] flex-col">
      <PublicHeroBackground
        tone="auth"
        bannerImageUrl={authBg.imageUrl}
        bannerOverlayColor={authBg.overlayColor}
        bannerOverlayOpacity={authBg.overlayOpacity}
        bannerFocalX={authBg.focalX}
        bannerFocalY={authBg.focalY}
      />

      {/* Top bar */}
      <header className="relative z-20 border-b border-white/10 bg-navy-950/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-white/80 hover:text-white"
            >
              <ChevronLeft className={cn('h-3.5 w-3.5', rtl && 'rotate-180')} />
              <Home className="h-3.5 w-3.5 sm:hidden" />
              <span className="hidden sm:inline">{t('auth.shell.backHome')}</span>
            </Link>
            <div className="hidden min-w-0 items-center gap-3 text-[11px] text-white/70 md:flex">
              {supportPhone ? (
                <a href={`tel:${supportPhone}`} className="flex items-center gap-1 hover:text-white">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{supportPhone}</span>
                </a>
              ) : null}
              {supportEmail ? (
                <a href={`mailto:${supportEmail}`} className="flex items-center gap-1 hover:text-white">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{supportEmail}</span>
                </a>
              ) : null}
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
          {/* Left branding — desktop only */}
          <div className="hidden text-white lg:block">
            <div className="max-w-md">
              {logoUrl ? (
                <div className="mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-white/10 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                  <Building2 className="h-8 w-8 text-white/90" />
                </div>
              )}
              <h1 className="text-3xl font-bold leading-tight tracking-tight drop-shadow-sm">
                {welcomeTitle}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/85">{welcomeDesc}</p>

              <ul className="mt-8 space-y-4 border-s-2 border-emerald-500/60 ps-5">
                {benefits.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                      <Icon className="h-4 w-4 text-emerald-200" />
                    </span>
                    <span className="text-sm leading-snug text-white/90">{text}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-xs leading-relaxed text-white/60">
                {t('auth.shell.dataSecure')}
              </p>
            </div>
          </div>

          {/* Right column — mobile header + card */}
          <div className="flex w-full flex-col lg:items-end">
            {/* Compact mobile branding */}
            <div className="mb-4 flex items-center gap-3 text-white lg:hidden">
              {logoUrl ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/20 bg-white/10 p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/10">
                  <Building2 className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{welcomeTitle}</p>
                <p className="line-clamp-2 text-[11px] text-white/75">{welcomeDesc}</p>
              </div>
            </div>

            <div
              className={cn(
                'w-full',
                wideCard ? 'max-w-lg lg:ms-auto' : 'max-w-md lg:ms-auto',
              )}
            >
              {children}
            </div>

            {belowCard ? <div className="mt-4 text-center">{belowCard}</div> : null}

            <p className="mt-4 text-center text-[10px] text-white/50 lg:text-end">
              {platformName} · {t('common.tagline')}
            </p>
          </div>
        </div>
      </main>

      <div className="relative z-10 h-1 bg-gradient-to-r from-red-600 via-white to-green-700" />
    </div>
  );
}
