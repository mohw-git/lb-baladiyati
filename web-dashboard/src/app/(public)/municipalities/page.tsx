'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslate, useLocale } from '@/lib/i18n';
import { municipalitiesApi, MunicipalityPublic } from '@/lib/api/endpoints/municipalities';
import { pickName, pickDescription } from '@shared/types/locale';
import {
  Building2,
  Search,
  MapPin,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  Globe,
} from 'lucide-react';

export default function MunicipalitiesPage() {
  const t = useTranslate();
  const locale = useLocale();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-municipalities'],
    queryFn: () => municipalitiesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const list: MunicipalityPublic[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
  const municipalities = list.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.nameAr || '').toLowerCase().includes(q) ||
      (m.nameFr || '').toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q)
    );
  });

  const localizedAddress = (m: MunicipalityPublic) => {
    if (locale === 'ar') return m.addressAr || m.address;
    if (locale === 'fr') return m.addressFr || m.address;
    return m.address;
  };

  const localizedHours = (m: MunicipalityPublic) => {
    if (locale === 'ar') return m.openingHoursAr || m.openingHours;
    if (locale === 'fr') return m.openingHoursFr || m.openingHours;
    return m.openingHours;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('public.municipalities.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('public.municipalities.subtitle')}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-sm">
        <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          className="input-gov w-full ps-8"
          placeholder={t('public.municipalities.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">{t('common.loading')}</div>
      ) : municipalities.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          {t('public.municipalities.noResults')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {municipalities.map((muni: MunicipalityPublic) => {
            const name = pickName(muni, locale);
            const desc = pickDescription(muni, locale);
            const address = localizedAddress(muni);
            const hours = localizedHours(muni);

            return (
              <div
                key={muni.id}
                className="flex flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-sm"
              >
                {/* Banner / Logo strip */}
                <div className="relative h-24 bg-navy-900">
                  {muni.bannerImageUrl && (
                    <img
                      src={muni.bannerImageUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: muni.bannerOverlayColor || '#0c1a2e',
                      opacity: muni.bannerOverlayOpacity ?? 0.55,
                    }}
                  />
                  <div className="absolute bottom-3 start-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-white/20 bg-white/10">
                      {muni.logoUrl ? (
                        <img src={muni.logoUrl} alt={name} className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-4 w-4 text-white/60" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-white drop-shadow">{name}</p>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  {desc && (
                    <p className="text-xs text-gray-600 line-clamp-2">{desc}</p>
                  )}

                  <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                    {address && (
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {address}
                      </p>
                    )}
                    {muni.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {muni.phone}
                      </p>
                    )}
                    {muni.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {muni.email}
                      </p>
                    )}
                    {hours && (
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {hours}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/municipalities/${muni.code.toLowerCase()}`}
                      className="btn-gov-secondary flex-1 justify-center text-xs"
                    >
                      {t('public.municipalities.viewProfile')}
                      <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Link>
                    <Link
                      href="/register"
                      className="btn-gov-primary flex-1 justify-center text-xs"
                    >
                      {t('public.municipalities.submitComplaint')}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
