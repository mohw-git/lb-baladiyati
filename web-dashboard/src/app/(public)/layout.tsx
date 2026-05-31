'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { useTranslate, useLocale } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { platformApi, PlatformBranding } from '@/lib/api/endpoints/platform';
import { getFileUrl } from '@/lib/api/client';
import {
  Landmark,
  Phone,
  Mail,
  Clock,
  Menu,
  X,
  Building2,
  LogIn,
  ExternalLink,
} from 'lucide-react';

function localizedField<T extends Record<string, any>>(
  obj: T | undefined | null,
  field: string,
  locale: string,
): string {
  if (!obj) return '';
  if (locale === 'ar') return obj[`${field}Ar`] || obj[field] || '';
  if (locale === 'fr') return obj[`${field}Fr`] || obj[field] || '';
  return obj[field] || '';
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslate();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: branding } = useQuery<PlatformBranding>({
    queryKey: ['public-platform-branding'],
    queryFn: () => platformApi.getBranding(),
    staleTime: 10 * 60 * 1000,
  });

  // Auto-redirect already-authenticated users into their panel.
  useEffect(() => {
    if (isHydrated && user) {
      router.replace('/dashboard');
    }
  }, [isHydrated, user, router]);

  const platformName = localizedField(branding, 'platformName', locale) || 'Baladiyati';
  const operatorName = localizedField(branding, 'operatorName', locale);
  const officeAddress = localizedField(branding, 'officeAddress', locale);
  const openingHours = localizedField(branding, 'openingHours', locale);
  const supportPhone = branding?.supportPhone;
  const supportEmail = branding?.supportEmail;
  const logoUrl = branding?.logoUrl ? getFileUrl(branding.logoUrl) : '';
  const year = new Date().getFullYear();
  const appLinks = [
    branding?.appStoreUrl?.trim(),
    branding?.googlePlayUrl?.trim(),
    branding?.apkUrl?.trim(),
  ].filter(Boolean);

  const navLinks: { label: string; href: string }[] = [
    { label: t('public.nav.municipalities'), href: '/municipalities' },
    { label: t('public.nav.announcements'), href: '/announcements' },
    { label: t('public.nav.faq'), href: '/faq' },
    { label: t('public.nav.contact'), href: '/contact' },
    ...(appLinks.length > 0 ? [{ label: t('public.nav.downloadApp'), href: '/download-app' }] : []),
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ── Ministry / Operator strip (very thin, dark) ───────────────────── */}
      <div className="border-b border-navy-900 bg-navy-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1 text-[11px] sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 truncate">
            {operatorName ? (
              <span className="flex items-center gap-1.5 truncate">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{operatorName}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-white/60">
                <Building2 className="h-3 w-3 shrink-0" />
                {t('public.topbar.officialPortal')}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {supportPhone && (
              <a href={`tel:${supportPhone}`} className="hidden items-center gap-1 hover:text-white sm:flex">
                <Phone className="h-3 w-3" />
                {supportPhone}
              </a>
            )}
            {openingHours && (
              <span className="hidden items-center gap-1 text-white/60 md:flex">
                <Clock className="h-3 w-3" />
                {openingHours}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Lebanese flag stripe ──────────────────────────────────────────── */}
      <div className="h-0.5 w-full bg-gradient-to-r from-red-600 via-white to-green-700" />

      {/* ── Main header: logo + name + nav + login ──────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-300 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2 sm:px-6 lg:px-8">
          {/* Logo + platform name */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-navy-900 bg-navy-900">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={platformName} className="h-full w-full object-cover" />
              ) : (
                <Landmark className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-navy-950">{platformName}</p>
              <p className="hidden text-[10px] uppercase tracking-wider text-gray-500 sm:block">
                {t('public.topbar.subtitle')}
              </p>
            </div>
          </Link>

          {/* Nav (desktop) */}
          <nav className="hidden flex-1 items-center justify-end gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  isActive(link.href)
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-navy-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="hidden items-center gap-1.5 rounded border border-navy-900 bg-navy-950 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-navy-900 sm:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t('public.nav.login')}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              className="rounded border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="border-t border-gray-200 bg-white lg:hidden">
            <ul className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded px-3 py-2 text-sm font-medium ${
                      isActive(link.href)
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-gray-100 pt-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded bg-navy-950 px-3 py-2 text-sm font-semibold text-white"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {t('public.nav.login')}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </header>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main className="flex-1 bg-white">{children}</main>

      {/* ── Footer (institutional, dense) ─────────────────────────────────── */}
      <footer className="border-t-2 border-navy-900 bg-navy-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {/* Brand block */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-white/20 bg-white/5">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={platformName} className="h-full w-full object-cover" />
                  ) : (
                    <Landmark className="h-4 w-4 text-white/80" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold">{platformName}</p>
                  {operatorName && (
                    <p className="text-[10px] uppercase tracking-wider text-white/50">
                      {operatorName}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-white/60">
                {localizedField(branding, 'platformDescription', locale) ||
                  t('public.footer.description')}
              </p>
              {(supportPhone || supportEmail || officeAddress) && (
                <ul className="mt-4 space-y-1 text-xs text-white/60">
                  {supportPhone && (
                    <li className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${supportPhone}`} className="hover:text-white">
                        {supportPhone}
                      </a>
                    </li>
                  )}
                  {supportEmail && (
                    <li className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <a href={`mailto:${supportEmail}`} className="hover:text-white">
                        {supportEmail}
                      </a>
                    </li>
                  )}
                  {officeAddress && (
                    <li className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{officeAddress}</span>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Citizen quick links */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                {t('public.footer.citizens')}
              </h4>
              <ul className="mt-3 space-y-1.5 text-xs">
                {[
                  { label: t('landing.footer.submitComplaint'), href: '/register' },
                  { label: t('landing.footer.trackComplaint'), href: '/login' },
                  { label: t('landing.footer.municipalities'), href: '/municipalities' },
                  { label: t('public.nav.announcements'), href: '/announcements' },
                  { label: t('landing.footer.faq'), href: '/faq' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/70 hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Platform / app */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                {t('public.footer.platform')}
              </h4>
              <ul className="mt-3 space-y-1.5 text-xs">
                <li>
                  <Link href="/contact" className="text-white/70 hover:text-white">
                    {t('public.nav.contact')}
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-white/70 hover:text-white">
                    {t('public.nav.login')}
                  </Link>
                </li>
                {branding?.appStoreUrl && (
                  <li>
                    <a
                      href={branding.appStoreUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-white/70 hover:text-white"
                    >
                      {t('public.download.appStore')}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </li>
                )}
                {branding?.googlePlayUrl && (
                  <li>
                    <a
                      href={branding.googlePlayUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-white/70 hover:text-white"
                    >
                      {t('public.download.googlePlay')}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-7 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
            <p className="text-[11px] text-white/50">
              {t('landing.footer.copyright', { year: String(year), platform: platformName })}
            </p>
            <div className="flex items-center gap-3">
              {operatorName && (
                <p className="text-[10px] text-white/40">
                  {t('landing.footer.operatedBy')} {operatorName}
                </p>
              )}
              <div className="h-1 w-16 rounded bg-gradient-to-r from-red-600 via-white to-green-700" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
