'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { municipalitiesApi } from '@/lib/api';
import { useTranslate, useLocale } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Loader2, Building2, Palette, Globe, Save, Image as ImageIcon, Phone, Mail, MapPin, Clock } from 'lucide-react';
import { ImageUploadCropper } from '@/components/ui/image-upload-cropper';

export default function MunicipalitySettingsPage() {
  const t = useTranslate();
  const locale = useLocale();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: municipality, isLoading } = useQuery({
    queryKey: ['municipality', 'current'],
    queryFn: () => municipalitiesApi.getCurrent(),
    enabled: !!user?.municipalityId,
  });

  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    nameFr: '',
    description: '',
    descriptionAr: '',
    descriptionFr: '',
    logoUrl: '',
    bannerImageUrl: '',
    bannerOverlayColor: '#0f2555',
    bannerOverlayOpacity: 0.6,
    primaryColor: '',
    email: '',
    phone: '',
    whatsApp: '',
    address: '',
    addressAr: '',
    addressFr: '',
    openingHours: '',
    openingHoursAr: '',
    openingHoursFr: '',
    website: '',
  });

  useEffect(() => {
    if (municipality) {
      setForm({
        name: municipality.name || '',
        nameAr: (municipality as any).nameAr || '',
        nameFr: (municipality as any).nameFr || '',
        description: (municipality as any).description || '',
        descriptionAr: (municipality as any).descriptionAr || '',
        descriptionFr: (municipality as any).descriptionFr || '',
        logoUrl: municipality.logoUrl || '',
        bannerImageUrl: (municipality as any).bannerImageUrl || '',
        bannerOverlayColor: (municipality as any).bannerOverlayColor || '#0f2555',
        bannerOverlayOpacity:
          typeof (municipality as any).bannerOverlayOpacity === 'number'
            ? (municipality as any).bannerOverlayOpacity
            : 0.6,
        primaryColor: (municipality as any).primaryColor || '',
        email: (municipality as any).email || '',
        phone: (municipality as any).phone || '',
        whatsApp: (municipality as any).whatsApp || '',
        address: (municipality as any).address || '',
        addressAr: (municipality as any).addressAr || '',
        addressFr: (municipality as any).addressFr || '',
        openingHours: (municipality as any).openingHours || '',
        openingHoursAr: (municipality as any).openingHoursAr || '',
        openingHoursFr: (municipality as any).openingHoursFr || '',
        website: (municipality as any).website || '',
      });
    }
  }, [municipality]);

  const saveMutation = useMutation({
    mutationFn: () =>
      municipalitiesApi.updateBranding({
        name: form.name || undefined,
        nameAr: form.nameAr || undefined,
        nameFr: form.nameFr || undefined,
        description: form.description || undefined,
        descriptionAr: form.descriptionAr || undefined,
        descriptionFr: form.descriptionFr || undefined,
        logoUrl: form.logoUrl || undefined,
        bannerImageUrl: form.bannerImageUrl || undefined,
        bannerOverlayColor: form.bannerOverlayColor || undefined,
        bannerOverlayOpacity:
          form.bannerImageUrl ? form.bannerOverlayOpacity : undefined,
        primaryColor: form.primaryColor || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        whatsApp: form.whatsApp || undefined,
        address: form.address || undefined,
        addressAr: form.addressAr || undefined,
        addressFr: form.addressFr || undefined,
        openingHours: form.openingHours || undefined,
        openingHoursAr: form.openingHoursAr || undefined,
        openingHoursFr: form.openingHoursFr || undefined,
        website: form.website || undefined,
      }),
    onSuccess: () => {
      toast.success(t('municipality.settings.toast.saved'));
      queryClient.invalidateQueries({ queryKey: ['municipality', 'current'] });
      queryClient.invalidateQueries({ queryKey: ['org-chart', 'municipality'] });
    },
    onError: () => toast.error(t('municipality.settings.toast.failed')),
  });

  const refreshMuni = (saved: any) => {
    queryClient.setQueryData(['municipality', 'current'], saved);
    setForm((prev) => ({
      ...prev,
      logoUrl: saved.logoUrl || '',
      bannerImageUrl: saved.bannerImageUrl || '',
    }));
  };

  const uploadLogo = async (file: File) => {
    try {
      const saved = await municipalitiesApi.uploadLogo(file);
      refreshMuni(saved);
      toast.success(t('upload.success'));
    } catch {
      toast.error(t('upload.error.uploadFailed'));
      throw new Error('upload_failed');
    }
  };

  const uploadBanner = async (file: File) => {
    try {
      const saved = await municipalitiesApi.uploadBanner(file);
      refreshMuni(saved);
      toast.success(t('upload.success'));
    } catch {
      toast.error(t('upload.error.uploadFailed'));
      throw new Error('upload_failed');
    }
  };

  const removeLogo = async () => {
    const saved = await municipalitiesApi.updateBranding({ logoUrl: '' });
    refreshMuni(saved);
    toast.success(t('upload.removed'));
  };

  const removeBanner = async () => {
    const saved = await municipalitiesApi.updateBranding({ bannerImageUrl: '' });
    refreshMuni(saved);
    toast.success(t('upload.removed'));
  };

  const localizedName =
    (locale === 'ar' && form.nameAr) ||
    (locale === 'fr' && form.nameFr) ||
    form.name ||
    municipality?.name;

  const localizedDescription =
    (locale === 'ar' && form.descriptionAr) ||
    (locale === 'fr' && form.descriptionFr) ||
    form.description ||
    '';

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Building2 className="h-5 w-5" />
            {t('municipality.settings.title')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('municipality.settings.subtitle')}</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="btn-gov-primary"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('municipality.settings.save')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Identity */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Globe className="h-4 w-4" />
              {t('municipality.settings.section.identity')}
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('municipality.settings.name.en')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="input-gov"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('municipality.settings.name.ar')}
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    className="input-gov"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('municipality.settings.name.fr')}
                  </label>
                  <input
                    type="text"
                    value={form.nameFr}
                    onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                    className="input-gov"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('municipality.settings.description.en')}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  maxLength={500}
                  className="input-gov"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('municipality.settings.description.ar')}
                  </label>
                  <textarea
                    dir="rtl"
                    value={form.descriptionAr}
                    onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                    rows={2}
                    maxLength={500}
                    className="input-gov"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('municipality.settings.description.fr')}
                  </label>
                  <textarea
                    value={form.descriptionFr}
                    onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
                    rows={2}
                    maxLength={500}
                    className="input-gov"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('municipality.settings.code')}
                </label>
                <input
                  type="text"
                  value={municipality?.code || ''}
                  disabled
                  className="input-gov bg-gray-50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Palette className="h-4 w-4" />
              {t('municipality.settings.section.branding')}
            </div>
            <div className="mt-3 space-y-4">
              {/* Logo upload + crop */}
              <ImageUploadCropper
                label={t('municipality.settings.logo')}
                hint={t('municipality.settings.logo.hint')}
                value={form.logoUrl}
                onCropped={uploadLogo}
                onRemove={removeLogo}
                aspect={1}
                circular={false}
                previewSize={72}
              />

              {/* Banner image upload + crop */}
              <ImageUploadCropper
                label={t('municipality.settings.section.branding') + ' — Banner'}
                hint={t('municipality.settings.banner.hint')}
                value={form.bannerImageUrl}
                onCropped={uploadBanner}
                onRemove={removeBanner}
                aspect={16 / 6}
                circular={false}
                previewSize={140}
              />

              {/* Banner overlay */}
              {form.bannerImageUrl && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Overlay color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.bannerOverlayColor}
                        onChange={(e) => setForm({ ...form, bannerOverlayColor: e.target.value })}
                        className="h-9 w-14 cursor-pointer rounded border border-gray-300 p-0.5"
                      />
                      <input
                        type="text"
                        value={form.bannerOverlayColor}
                        onChange={(e) => setForm({ ...form, bannerOverlayColor: e.target.value })}
                        maxLength={7}
                        className="input-gov w-32 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Overlay opacity ({Math.round(form.bannerOverlayOpacity * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={form.bannerOverlayOpacity}
                      onChange={(e) =>
                        setForm({ ...form, bannerOverlayOpacity: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Primary color */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('municipality.settings.primaryColor')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primaryColor || '#0f2555'}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded border border-gray-300 p-0.5"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    placeholder="#0f2555"
                    maxLength={7}
                    className="input-gov w-32 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="gov-card p-4">
          <div className="gov-section-header">
            <ImageIcon className="h-4 w-4" />
            {t('municipality.settings.preview')}
          </div>

          {/* Sidebar preview */}
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Sidebar
            </p>
            <div
              className="relative overflow-hidden rounded text-white"
              style={{
                backgroundColor: form.primaryColor || '#0f2555',
              }}
            >
              {form.bannerImageUrl && (
                <>
                  <img
                    src={form.bannerImageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: form.bannerOverlayColor,
                      opacity: form.bannerOverlayOpacity,
                    }}
                  />
                </>
              )}
              <div className="relative flex items-center gap-2 px-3 py-3">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt=""
                    className="h-8 w-8 rounded object-contain bg-white/10"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-white/20 text-sm font-bold">
                    {(localizedName || municipality?.code || 'M').charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-tight truncate">
                    {localizedName || 'Municipality'}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-white/70 truncate">
                    {t('common.tagline')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Public Contact Information */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Phone className="h-4 w-4" />
              {t('municipality.settings.contact')}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.email')}</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input type="email" className="input-gov ps-8" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.phone')}</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input type="tel" className="input-gov ps-8" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.whatsApp')}</label>
                <input type="tel" className="input-gov" value={form.whatsApp} onChange={(e) => setForm({ ...form, whatsApp: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.website')}</label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input type="url" className="input-gov ps-8" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.address')}</label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input className="input-gov ps-8" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.addressAr')}</label>
                <input className="input-gov text-right" dir="rtl" value={form.addressAr} onChange={(e) => setForm({ ...form, addressAr: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.addressFr')}</label>
                <input className="input-gov" value={form.addressFr} onChange={(e) => setForm({ ...form, addressFr: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.openingHours')}</label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input className="input-gov ps-8" value={form.openingHours} onChange={(e) => setForm({ ...form, openingHours: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.openingHoursAr')}</label>
                <input className="input-gov text-right" dir="rtl" value={form.openingHoursAr} onChange={(e) => setForm({ ...form, openingHoursAr: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('municipality.settings.openingHoursFr')}</label>
                <input className="input-gov" value={form.openingHoursFr} onChange={(e) => setForm({ ...form, openingHoursFr: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Login / dashboard banner preview */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Login / Dashboard header
            </p>
            <div
              className="relative h-28 overflow-hidden rounded text-white"
              style={{
                backgroundColor: form.primaryColor || '#0f2555',
              }}
            >
              {form.bannerImageUrl && (
                <>
                  <img
                    src={form.bannerImageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: form.bannerOverlayColor,
                      opacity: form.bannerOverlayOpacity,
                    }}
                  />
                </>
              )}
              <div className="relative flex h-full items-center gap-3 px-4">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt=""
                    className="h-12 w-12 rounded object-contain bg-white/10 p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-white/20 text-lg font-bold">
                    {(localizedName || municipality?.code || 'M').charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-tight truncate">
                    {localizedName || 'Municipality'}
                  </div>
                  {localizedDescription && (
                    <div className="mt-0.5 text-[11px] text-white/85 line-clamp-2">
                      {localizedDescription}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
