'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslate, useLocale } from '@/lib/i18n';
import { platformApi, PlatformBranding } from '@/lib/api/endpoints/platform';
import { Phone, Mail, MapPin, Clock, MessageCircle, ChevronRight, Building2 } from 'lucide-react';

function localizedField(b: PlatformBranding | undefined, field: string, locale: string): string {
  if (!b) return '';
  if (locale === 'ar') return (b as any)[`${field}Ar`] || (b as any)[field] || '';
  if (locale === 'fr') return (b as any)[`${field}Fr`] || (b as any)[field] || '';
  return (b as any)[field] || '';
}

export default function ContactPage() {
  const t = useTranslate();
  const locale = useLocale();

  const { data: branding } = useQuery<PlatformBranding>({
    queryKey: ['public-platform-branding'],
    queryFn: () => platformApi.getBranding(),
    staleTime: 10 * 60 * 1000,
  });

  const platformName = localizedField(branding, 'platformName', locale) || 'Baladiyati';
  const operatorName = localizedField(branding, 'operatorName', locale);
  const address = localizedField(branding, 'officeAddress', locale);
  const hours = localizedField(branding, 'openingHours', locale);
  const supportEmail = branding?.supportEmail;
  const supportPhone = branding?.supportPhone;
  const supportWhatsApp = branding?.supportWhatsApp;

  const hasContact = supportEmail || supportPhone || supportWhatsApp || address || hours;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('public.contact.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('public.contact.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Platform Support */}
        <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-bold text-gray-900">
            {t('public.contact.platformSupport')}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            {t('public.contact.platformSupportDesc')}
          </p>

          {hasContact ? (
            <div className="space-y-3">
              {supportPhone && (
                <div className="flex items-center gap-2.5 text-sm text-gray-700">
                  <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                  <a href={`tel:${supportPhone}`} className="hover:text-brand-700">
                    {supportPhone}
                  </a>
                </div>
              )}
              {supportWhatsApp && (
                <div className="flex items-center gap-2.5 text-sm text-gray-700">
                  <MessageCircle className="h-4 w-4 shrink-0 text-green-500" />
                  <a
                    href={`https://wa.me/${supportWhatsApp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand-700"
                  >
                    {supportWhatsApp}
                  </a>
                </div>
              )}
              {supportEmail && (
                <div className="flex items-center gap-2.5 text-sm text-gray-700">
                  <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                  <a href={`mailto:${supportEmail}`} className="hover:text-brand-700">
                    {supportEmail}
                  </a>
                </div>
              )}
              {address && (
                <div className="flex items-start gap-2.5 text-sm text-gray-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  {address}
                </div>
              )}
              {hours && (
                <div className="flex items-center gap-2.5 text-sm text-gray-700">
                  <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                  {hours}
                </div>
              )}
              {operatorName && (
                <div className="flex items-center gap-2.5 text-xs text-gray-500">
                  <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                  {t('public.contact.operatedBy')} {operatorName}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">{t('public.contact.noContact')}</p>
          )}
        </div>

        {/* Municipality directory */}
        <div className="rounded border border-gray-200 bg-gray-50 p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-bold text-gray-900">
            {t('public.contact.muniDirectory')}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            {t('public.contact.muniDirectoryDesc')}
          </p>
          <Link
            href="/municipalities"
            className="btn-gov-primary w-full justify-center"
          >
            {t('public.contact.viewMunicipalities')}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
}
