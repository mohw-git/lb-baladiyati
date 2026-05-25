'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslate, useLocale } from '@/lib/i18n';
import { municipalitiesApi, MunicipalityPublic } from '@/lib/api/endpoints/municipalities';
import { pickName, pickDescription } from '@shared/types/locale';
import {
  DEFAULT_BANNER_OVERLAY_COLOR,
  normalizeOverlayOpacity,
  resolveMunicipalityMediaUrl,
  sanitizeHexColor,
} from '@/lib/municipality-branding';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Globe,
  MessageSquareWarning,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Tag,
} from 'lucide-react';

export default function MunicipalityProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const t = useTranslate();
  const locale = useLocale();
  const slug = params.slug; // e.g. "bei"

  const { data: muni, isLoading, isError } = useQuery<MunicipalityPublic>({
    queryKey: ['public-municipality', slug],
    queryFn: () => municipalitiesApi.getByCode(slug),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-gray-400">{t('common.loading')}</div>
    );
  }

  if (isError || !muni) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <Building2 className="mx-auto mb-4 h-10 w-10 text-gray-300" />
        <p className="text-sm text-gray-500">{t('public.municipalities.notFound')}</p>
        <Link href="/municipalities" className="btn-gov-secondary mt-4 mx-auto">
          {t('public.municipalities.backToList')}
        </Link>
      </div>
    );
  }

  const name = pickName(muni, locale);
  const desc = pickDescription(muni, locale);
  const address = locale === 'ar' ? (muni.addressAr || muni.address) : locale === 'fr' ? (muni.addressFr || muni.address) : muni.address;
  const hours = locale === 'ar' ? (muni.openingHoursAr || muni.openingHours) : locale === 'fr' ? (muni.openingHoursFr || muni.openingHours) : muni.openingHours;

  const ChevronBack = locale === 'ar' ? ChevronRight : ChevronLeft;

  const allCategories = (muni.departments ?? []).flatMap((d) => d.categories ?? []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/municipalities"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand-700"
      >
        <ChevronBack className="h-3.5 w-3.5" />
        {t('public.municipalities.backToList')}
      </Link>

      {/* Banner */}
      <div className="relative mb-6 h-48 overflow-hidden rounded border border-gray-200 bg-navy-900 sm:h-56">
        {muni.bannerImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveMunicipalityMediaUrl(muni.bannerImageUrl)}
            alt={name}
            className="h-full w-full object-cover"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: sanitizeHexColor(
              muni.bannerOverlayColor,
              DEFAULT_BANNER_OVERLAY_COLOR,
            ),
            opacity: normalizeOverlayOpacity(muni.bannerOverlayOpacity),
          }}
        />

        {/* Logo + name overlay */}
        <div className="absolute bottom-4 start-5 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-white/20 bg-white/10 backdrop-blur-sm">
            {muni.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveMunicipalityMediaUrl(muni.logoUrl)}
                alt={name}
                className="h-full w-full object-contain"
              />
            ) : (
              <Building2 className="h-7 w-7 text-white/60" />
            )}
          </div>
          <div>
            <p className="text-xl font-bold text-white drop-shadow">{name}</p>
            {muni.code && (
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">
                {muni.code}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: description + services */}
        <div className="lg:col-span-2 space-y-5">
          {desc && (
            <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm leading-relaxed text-gray-700">{desc}</p>
            </div>
          )}

          {/* Submit complaint CTA */}
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 rounded border border-brand-200 bg-brand-50 px-5 py-3 text-sm font-bold text-brand-800 hover:bg-brand-100 transition-colors"
          >
            <MessageSquareWarning className="h-4 w-4" />
            {t('public.municipalities.submitComplaint')} — {name}
          </Link>

          {/* Service categories */}
          {allCategories.length > 0 && (
            <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Tag className="h-4 w-4 text-brand-600" />
                {t('public.municipalities.services')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((cat) => {
                  const catName = locale === 'ar' ? (cat.nameAr || cat.name) : locale === 'fr' ? (cat.nameFr || cat.name) : cat.name;
                  return (
                    <span
                      key={cat.id}
                      className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                    >
                      {catName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: contact card */}
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
              {t('public.contact.title')}
            </h2>
            <div className="space-y-2.5 text-sm">
              {address && (
                <div className="flex items-start gap-2.5 text-gray-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  {address}
                </div>
              )}
              {muni.phone && (
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                  <a href={`tel:${muni.phone}`} className="hover:text-brand-700">
                    {muni.phone}
                  </a>
                </div>
              )}
              {muni.whatsApp && (
                <div className="flex items-center gap-2.5 text-gray-700">
                  <MessageCircle className="h-4 w-4 shrink-0 text-green-500" />
                  <a
                    href={`https://wa.me/${muni.whatsApp?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand-700"
                  >
                    {muni.whatsApp}
                  </a>
                </div>
              )}
              {muni.email && (
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                  <a href={`mailto:${muni.email}`} className="hover:text-brand-700">
                    {muni.email}
                  </a>
                </div>
              )}
              {hours && (
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                  {hours}
                </div>
              )}
              {muni.website && (
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Globe className="h-4 w-4 shrink-0 text-gray-400" />
                  <a
                    href={muni.website}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand-700 truncate"
                  >
                    {muni.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
