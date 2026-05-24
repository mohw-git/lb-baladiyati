'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslate, useLocale } from '@/lib/i18n';
import { platformApi, PlatformBranding } from '@/lib/api/endpoints/platform';
import { municipalitiesApi, MunicipalityPublic } from '@/lib/api/endpoints/municipalities';
import { pickName } from '@shared/types/locale';
import {
  MessageSquareWarning,
  Eye,
  Smartphone,
  ChevronRight,
  MapPin,
  Phone,
  Building2,
  AlertTriangle,
  ShieldCheck,
  Megaphone,
  ScrollText,
  HardHat,
  Trash2,
  Droplets,
  Lightbulb,
  TreeDeciduous,
  ClipboardList,
} from 'lucide-react';

function localized<T extends Record<string, any>>(
  obj: T | undefined | null,
  field: string,
  locale: string,
): string {
  if (!obj) return '';
  if (locale === 'ar') return obj[`${field}Ar`] || obj[field] || '';
  if (locale === 'fr') return obj[`${field}Fr`] || obj[field] || '';
  return obj[field] || '';
}

export default function HomePage() {
  const t = useTranslate();
  const locale = useLocale();

  const { data: branding } = useQuery<PlatformBranding>({
    queryKey: ['public-platform-branding'],
    queryFn: () => platformApi.getBranding(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: muniData } = useQuery({
    queryKey: ['public-municipalities'],
    queryFn: () => municipalitiesApi.list(),
    staleTime: 10 * 60 * 1000,
  });

  const municipalities: MunicipalityPublic[] = Array.isArray(muniData)
    ? (muniData as any)
    : ((muniData as any)?.data ?? []);

  const platformName = localized(branding, 'platformName', locale) || t('common.appName');
  const platformDescription =
    localized(branding, 'platformDescription', locale) || t('public.hero.fallbackSubtitle');
  const bannerUrl = branding?.bannerImageUrl;
  const overlayColor = branding?.bannerOverlayColor || '#0c1a2e';
  const overlayOpacity = branding?.bannerOverlayOpacity ?? 0.65;
  const supportPhone = branding?.supportPhone;
  const appLinks = [branding?.appStoreUrl, branding?.googlePlayUrl, branding?.apkUrl].filter(Boolean);

  // Public service categories — generic municipal scope, citizen-relevant.
  const services: { icon: React.ElementType; key: string; tone: string }[] = [
    { icon: HardHat, key: 'public.services.roads', tone: 'text-amber-700 bg-amber-50' },
    { icon: Trash2, key: 'public.services.sanitation', tone: 'text-emerald-700 bg-emerald-50' },
    { icon: Droplets, key: 'public.services.water', tone: 'text-blue-700 bg-blue-50' },
    { icon: Lightbulb, key: 'public.services.lighting', tone: 'text-yellow-700 bg-yellow-50' },
    { icon: TreeDeciduous, key: 'public.services.parks', tone: 'text-green-700 bg-green-50' },
    { icon: ShieldCheck, key: 'public.services.safety', tone: 'text-red-700 bg-red-50' },
  ];

  // Citizen help cards — institutional, not marketing.
  const helpItems: { key: string; descKey: string; icon: React.ElementType }[] = [
    { key: 'public.help.howSubmit', descKey: 'public.help.howSubmit.desc', icon: ClipboardList },
    { key: 'public.help.howTrack', descKey: 'public.help.howTrack.desc', icon: Eye },
    { key: 'public.help.responseTimes', descKey: 'public.help.responseTimes.desc', icon: ScrollText },
    { key: 'public.help.emergency', descKey: 'public.help.emergency.desc', icon: AlertTriangle },
  ];

  return (
    <>
      {/* ───────────────────────────── HERO (institutional, dense) ─────────────────────── */}
      <section className="relative isolate text-white" style={{ minHeight: 280 }}>
        {/* Banner image OR neutral institutional fallback */}
        <div className="absolute inset-0 bg-navy-950">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd' stroke='%23ffffff' stroke-opacity='1'%3E%3Cpath d='M0 40h80M40 0v80'/%3E%3Cpath d='M20 20h40v40H20z'/%3E%3C/g%3E%3C/svg%3E\")",
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: overlayColor, opacity: bannerUrl ? overlayOpacity : 0.45 }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[2fr,1fr]">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/60">
                {t('public.topbar.officialPortal')}
              </p>
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                {platformName}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-[15px]">
                {platformDescription}
              </p>

              {/* Citizen actions — minimal, governmental, no SaaS pill style */}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-sm bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-navy-950 hover:bg-gray-100"
                >
                  <MessageSquareWarning className="h-3.5 w-3.5" />
                  {t('public.hero.submitComplaint')}
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-sm border border-white/30 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/15"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {t('public.hero.trackComplaint')}
                </Link>
                {appLinks.length > 0 && (
                  <Link
                    href="/download-app"
                    className="inline-flex items-center gap-2 rounded-sm border border-white/30 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/15"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    {t('public.hero.downloadApp')}
                  </Link>
                )}
              </div>
            </div>

            {/* Hero side card — emergency / hotline / institutional info */}
            <aside className="rounded border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('public.hero.emergency')}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/70">
                {t('public.hero.emergency.desc')}
              </p>
              {supportPhone && (
                <a
                  href={`tel:${supportPhone}`}
                  className="mt-3 flex items-center gap-2 rounded border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20"
                >
                  <Phone className="h-4 w-4" />
                  {supportPhone}
                </a>
              )}
              <Link
                href="/contact"
                className="mt-2 block text-center text-[11px] text-white/60 hover:text-white"
              >
                {t('public.hero.allContacts')} →
              </Link>
            </aside>
          </div>
        </div>

        {/* Bottom Lebanese flag accent */}
        <div className="absolute bottom-0 start-0 end-0 h-1 bg-gradient-to-r from-red-600 via-white to-green-700" />
      </section>

      {/* ───────────────────────────── PARTICIPATING MUNICIPALITIES ─────────────────────── */}
      <section className="border-b border-gray-200 bg-white py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-5 flex items-end justify-between border-b border-gray-200 pb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                {t('public.section.directory')}
              </p>
              <h2 className="text-lg font-bold text-navy-950 sm:text-xl">
                {t('public.municipalities.title')}
              </h2>
            </div>
            <Link
              href="/municipalities"
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            >
              {t('common.viewAll')}
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </header>

          {municipalities.length === 0 ? (
            <p className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-400">
              {t('public.municipalities.noResults')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {municipalities.slice(0, 8).map((muni) => {
                const name = pickName(muni, locale);
                const address = locale === 'ar'
                  ? muni.addressAr || muni.address
                  : locale === 'fr'
                  ? muni.addressFr || muni.address
                  : muni.address;
                return (
                  <Link
                    key={muni.id}
                    href={`/municipalities/${muni.code.toLowerCase()}`}
                    className="group flex items-center gap-3 rounded border border-gray-200 bg-white p-3 transition-colors hover:border-navy-700 hover:bg-gray-50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
                      {muni.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={muni.logoUrl} alt={name} className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy-950 group-hover:text-brand-700">
                        {name}
                      </p>
                      {address && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {address}
                        </p>
                      )}
                      {muni.phone && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-500">
                          <Phone className="h-3 w-3 shrink-0" />
                          {muni.phone}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────────────────── PUBLIC ANNOUNCEMENTS (placeholder until news API) ── */}
      <section className="border-b border-gray-200 bg-gray-50 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-5 flex items-end justify-between border-b border-gray-200 pb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                {t('public.section.announcements')}
              </p>
              <h2 className="text-lg font-bold text-navy-950 sm:text-xl">
                {t('public.announcements.title')}
              </h2>
            </div>
            <Link
              href="/announcements"
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            >
              {t('common.viewAll')}
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </header>
          <div className="rounded border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            <Megaphone className="mx-auto mb-2 h-6 w-6 text-gray-300" />
            {t('public.announcements.empty')}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── PUBLIC SERVICES / CATEGORIES ─────────────────────── */}
      <section className="border-b border-gray-200 bg-white py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-5 border-b border-gray-200 pb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {t('public.section.services')}
            </p>
            <h2 className="text-lg font-bold text-navy-950 sm:text-xl">
              {t('public.services.title')}
            </h2>
            <p className="mt-1 text-xs text-gray-500">{t('public.services.subtitle')}</p>
          </header>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.key}
                  href="/register"
                  className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3 transition-colors hover:border-navy-700 hover:bg-gray-50"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${s.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-gray-800">{t(s.key as any)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── CITIZEN HELP (no flow diagrams) ─────────────────── */}
      <section className="border-b border-gray-200 bg-gray-50 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-5 border-b border-gray-200 pb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {t('public.section.help')}
            </p>
            <h2 className="text-lg font-bold text-navy-950 sm:text-xl">
              {t('public.help.title')}
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {helpItems.map(({ key, descKey, icon: Icon }) => (
              <div key={key} className="flex items-start gap-3 rounded border border-gray-200 bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50">
                  <Icon className="h-4 w-4 text-navy-700" />
                </span>
                <div>
                  <p className="text-sm font-bold text-navy-950">{t(key as any)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{t(descKey as any)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── MOBILE APP ───────────────────────────────────────── */}
      {appLinks.length > 0 && (
        <section className="border-b border-gray-200 bg-navy-950 py-8 text-white sm:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-white/20 bg-white/5">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold sm:text-lg">{t('public.download.title')}</h2>
                  <p className="mt-1 max-w-md text-xs text-white/60 sm:text-[13px]">
                    {t('public.download.subtitle')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {branding?.appStoreUrl && (
                  <a
                    href={branding.appStoreUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide hover:bg-white/20"
                  >
                    {t('public.download.appStore')}
                  </a>
                )}
                {branding?.googlePlayUrl && (
                  <a
                    href={branding.googlePlayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide hover:bg-white/20"
                  >
                    {t('public.download.googlePlay')}
                  </a>
                )}
                {branding?.apkUrl && (
                  <a
                    href={branding.apkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide hover:bg-white/20"
                  >
                    {t('public.download.apk')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────── PLATFORM SUPPORT BAND ────────────────────────────── */}
      <section className="bg-white py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded border border-gray-200 bg-gray-50 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-bold text-navy-950">{t('public.contact.platformSupport')}</p>
              <p className="mt-0.5 text-xs text-gray-600">
                {t('public.contact.platformSupportDesc')}
              </p>
            </div>
            <Link href="/contact" className="btn-gov-primary text-xs">
              {t('public.faq.contactUs')}
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
