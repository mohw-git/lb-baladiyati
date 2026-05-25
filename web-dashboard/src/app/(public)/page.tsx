'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslate, useLocale } from '@/lib/i18n';
import { platformApi, PlatformBranding } from '@/lib/api/endpoints/platform';
import { PublicAnnouncementsSection } from '@/components/public/public-announcements-section';
import { municipalitiesApi, MunicipalityPublic } from '@/lib/api/endpoints/municipalities';
import { pickName } from '@shared/types/locale';
import { PublicHeroBackground } from '@/components/brand/public-hero-background';
import {
  normalizeBannerFocal,
  resolveBrandMediaUrl,
  resolveMunicipalityMediaUrl,
} from '@/lib/municipality-branding';
import {
  MessageSquareWarning,
  Eye,
  Smartphone,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
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
  const logoUrl = resolveBrandMediaUrl(branding?.logoUrl);
  const bannerFocalX = normalizeBannerFocal(branding?.bannerFocalX);
  const bannerFocalY = normalizeBannerFocal(branding?.bannerFocalY);
  const supportPhone = branding?.supportPhone;
  const supportEmail = branding?.supportEmail;
  const supportWhatsApp = branding?.supportWhatsApp;
  const hasPlatformContact =
    Boolean(supportPhone || supportEmail || supportWhatsApp);
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
      {/* ───────────────────────────── HERO ─────────────────────── */}
      <section className="relative isolate min-h-[22rem] text-white sm:min-h-[26rem] lg:min-h-[28rem]">
        <PublicHeroBackground
          bannerImageUrl={branding?.bannerImageUrl}
          bannerOverlayColor={branding?.bannerOverlayColor}
          bannerOverlayOpacity={branding?.bannerOverlayOpacity}
          bannerFocalX={bannerFocalX}
          bannerFocalY={bannerFocalY}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid items-center gap-8 lg:grid-cols-[1.65fr,1fr] lg:gap-10">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-sm border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/80">
                {t('public.topbar.officialPortal')}
              </p>
              <div className="flex items-start gap-4">
                {logoUrl ? (
                  <div className="hidden h-14 w-14 shrink-0 overflow-hidden rounded border border-white/25 bg-white/10 p-1 sm:block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h1 className="text-3xl font-bold leading-tight tracking-tight drop-shadow-sm sm:text-4xl lg:text-[2.5rem]">
                    {platformName}
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
                    {platformDescription}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-sm bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-navy-950 shadow-sm transition-colors hover:bg-gray-100"
                >
                  <MessageSquareWarning className="h-4 w-4" />
                  {t('public.hero.submitComplaint')}
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-sm border border-white/40 bg-white/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  <Eye className="h-4 w-4" />
                  {t('public.hero.trackComplaint')}
                </Link>
                {appLinks.length > 0 && (
                  <Link
                    href="/download-app"
                    className="inline-flex items-center gap-2 rounded-sm border border-white/40 bg-white/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                  >
                    <Smartphone className="h-4 w-4" />
                    {t('public.hero.downloadApp')}
                  </Link>
                )}
              </div>
            </div>

            <aside className="rounded-md border border-white/20 bg-navy-950/40 p-5 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2 border-b border-white/15 pb-3 text-[11px] font-bold uppercase tracking-wider text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t('public.hero.emergency')}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                {t('public.hero.emergency.desc')}
              </p>
              {supportPhone ? (
                <a
                  href={`tel:${supportPhone}`}
                  className="mt-4 flex items-center justify-center gap-2 rounded-sm border border-white/25 bg-white/15 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-white/25"
                >
                  <Phone className="h-5 w-5" />
                  {supportPhone}
                </a>
              ) : null}
              <Link
                href="/contact"
                className="mt-3 block text-center text-xs font-medium text-white/70 underline-offset-2 hover:text-white hover:underline"
              >
                {t('public.hero.allContacts')} →
              </Link>
            </aside>
          </div>
        </div>

        <div className="absolute bottom-0 start-0 end-0 z-10 h-1 bg-gradient-to-r from-red-600 via-white to-green-700" />
      </section>

      {/* ───────────────────────────── PARTICIPATING MUNICIPALITIES ─────────────────────── */}
      <section className="border-b border-gray-200 bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-end justify-between border-s-4 border-s-brand-700 ps-4">
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
            <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
              {t('public.municipalities.noResults')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    className="group flex items-center gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-navy-800 hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                      {muni.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveMunicipalityMediaUrl(muni.logoUrl)}
                          alt={name}
                          className="h-full w-full object-contain"
                        />
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

      <PublicAnnouncementsSection />

      {/* ───────────────────────────── PUBLIC SERVICES / CATEGORIES ─────────────────────── */}
      <section className="border-b border-gray-200 bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-6 border-s-4 border-s-navy-800 ps-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {t('public.section.services')}
            </p>
            <h2 className="text-lg font-bold text-navy-950 sm:text-xl">
              {t('public.services.title')}
            </h2>
            <p className="mt-1 text-xs text-gray-500">{t('public.services.subtitle')}</p>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.key}
                  href="/register"
                  className="flex items-center gap-2.5 rounded-md border border-gray-200 bg-white p-3.5 shadow-sm transition-all hover:border-navy-800 hover:shadow-md"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${s.tone}`}>
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
      <section className="border-b border-gray-200 bg-gray-50 py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-6 border-s-4 border-s-red-600/80 ps-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {t('public.section.help')}
            </p>
            <h2 className="text-lg font-bold text-navy-950 sm:text-xl">
              {t('public.help.title')}
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {helpItems.map(({ key, descKey, icon: Icon }) => (
              <div
                key={key}
                className="flex items-start gap-4 rounded-md border border-gray-200 bg-white p-5 shadow-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
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
        <section className="border-b border-gray-200 bg-navy-950 py-10 text-white sm:py-12">
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
      <section className="bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-bold text-navy-950">
                  {t('public.contact.platformSupport')}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {t('public.contact.platformSupportDesc')}
                </p>
              </div>
              <Link href="/contact" className="btn-gov-primary shrink-0 text-xs">
                {t('public.faq.contactUs')}
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </div>
            {hasPlatformContact ? (
              <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-200 pt-4 text-sm text-gray-700">
                {supportPhone && (
                  <a
                    href={`tel:${supportPhone}`}
                    className="inline-flex items-center gap-2 hover:text-brand-700"
                  >
                    <Phone className="h-4 w-4 text-gray-400" />
                    {supportPhone}
                  </a>
                )}
                {supportEmail && (
                  <a
                    href={`mailto:${supportEmail}`}
                    className="inline-flex items-center gap-2 hover:text-brand-700"
                  >
                    <Mail className="h-4 w-4 text-gray-400" />
                    {supportEmail}
                  </a>
                )}
                {supportWhatsApp && (
                  <a
                    href={`https://wa.me/${supportWhatsApp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 hover:text-brand-700"
                  >
                    <MessageSquareWarning className="h-4 w-4 text-green-600" />
                    {supportWhatsApp}
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm italic text-gray-400">
                {t('public.contact.noContact')}
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
