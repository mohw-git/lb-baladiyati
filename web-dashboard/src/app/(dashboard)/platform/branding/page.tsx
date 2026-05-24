'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi, PlatformBranding, UpdatePlatformBrandingRequest } from '@/lib/api/endpoints/platform';
import { useTranslate, useLocale } from '@/lib/i18n';
import { toast } from 'sonner';
import { ImageUploadCropper } from '@/components/ui/image-upload-cropper';
import {
  Landmark,
  Save,
  Image as ImageIcon,
  Phone,
  Mail,
  MapPin,
  Clock,
  Smartphone,
  Globe,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type SectionKey = 'identity' | 'hero' | 'operator' | 'contact' | 'apps';

function SectionHeader({
  title,
  icon,
  open,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between border-b border-gray-200 pb-2 text-start"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <span className="text-brand-600">{icon}</span>
        {title}
      </div>
      {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-700">{label}</label>
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
      {children}
    </div>
  );
}

export default function PlatformBrandingPage() {
  const t = useTranslate();
  const locale = useLocale();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    identity: true,
    hero: true,
    operator: false,
    contact: false,
    apps: false,
  });

  const { data: branding, isLoading } = useQuery({
    queryKey: ['platform-branding'],
    queryFn: () => platformApi.getBranding(),
  });

  const [form, setForm] = useState<UpdatePlatformBrandingRequest>({});

  const set = (field: keyof UpdatePlatformBrandingRequest, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value === '' ? null : value }));
  };

  const val = (field: keyof PlatformBranding) => {
    if (field in form) return (form as Record<string, unknown>)[field] ?? '';
    return branding?.[field] ?? '';
  };

  const toggleSection = (key: SectionKey) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const saveMut = useMutation({
    mutationFn: () => platformApi.updateBranding(form),
    onSuccess: (saved) => {
      // Use the server response directly so the form reflects what was
      // actually persisted. This avoids the race between `invalidate -> refetch`
      // and `setForm({})`, which previously caused fields to appear blank.
      qc.setQueryData(['platform-branding'], saved);
      qc.invalidateQueries({ queryKey: ['public-platform-branding'] });
      toast.success(t('platform.branding.saved'));
      setForm({});
    },
    onError: () => toast.error(t('common.error')),
  });

  const uploadLogo = async (file: File) => {
    try {
      const saved = await platformApi.uploadBrandingLogo(file);
      qc.setQueryData(['platform-branding'], saved);
      qc.invalidateQueries({ queryKey: ['public-platform-branding'] });
      toast.success(t('upload.success'));
    } catch {
      toast.error(t('upload.error.uploadFailed'));
      throw new Error('upload_failed');
    }
  };

  const uploadBanner = async (file: File) => {
    try {
      const saved = await platformApi.uploadBrandingBanner(file);
      qc.setQueryData(['platform-branding'], saved);
      qc.invalidateQueries({ queryKey: ['public-platform-branding'] });
      toast.success(t('upload.success'));
    } catch {
      toast.error(t('upload.error.uploadFailed'));
      throw new Error('upload_failed');
    }
  };

  const removeLogo = async () => {
    const saved = await platformApi.updateBranding({ logoUrl: null as any });
    qc.setQueryData(['platform-branding'], saved);
    qc.invalidateQueries({ queryKey: ['public-platform-branding'] });
    toast.success(t('upload.removed'));
  };

  const removeBanner = async () => {
    const saved = await platformApi.updateBranding({ bannerImageUrl: null as any });
    qc.setQueryData(['platform-branding'], saved);
    qc.invalidateQueries({ queryKey: ['public-platform-branding'] });
    toast.success(t('upload.removed'));
  };

  const overlayColor = (val('bannerOverlayColor') as string) || '#0c1a2e';
  const overlayOpacity = Number(val('bannerOverlayOpacity') || 0.65);
  const bannerUrl = val('bannerImageUrl') as string;
  const logoUrl = val('logoUrl') as string;
  const platformName = (locale === 'ar'
    ? val('platformNameAr')
    : locale === 'fr'
    ? val('platformNameFr')
    : val('platformName')) as string || 'Baladi';

  const dirtyCount = Object.keys(form).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 pb-20 sm:p-6">
      {/* Page header — institutional, single line */}
      <header className="border-b border-gray-200 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-navy-950">{t('platform.branding.title')}</h1>
            <p className="mt-0.5 text-xs text-gray-500">{t('platform.branding.subtitle')}</p>
          </div>
          {dirtyCount > 0 && (
            <span className="hidden items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 sm:inline-flex">
              {t('platform.branding.unsaved', { n: String(dirtyCount) })}
            </span>
          )}
        </div>
      </header>

      {/* Live banner preview */}
      <div className="gov-card overflow-hidden p-0">
        <div className="border-b border-gray-200 px-4 py-2.5">
          <p className="text-xs font-semibold text-gray-600">{t('platform.branding.previewBanner')}</p>
          <p className="text-[11px] text-gray-400">{t('platform.branding.previewNote')}</p>
        </div>
        <div className="relative h-36 bg-navy-950">
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt="Banner preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: overlayColor, opacity: overlayOpacity }}
          />
          <div className="relative flex h-full items-center gap-3 px-6">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-white/15">
                <Landmark className="h-5 w-5 text-white/80" />
              </div>
            )}
            <div>
              <p className="text-base font-bold text-white">{platformName}</p>
              <p className="text-[11px] text-white/60">{t('common.tagline')}</p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="gov-card py-10 text-center text-sm text-gray-500">{t('common.loading')}</div>
      ) : (
        <div className="space-y-5">
          {/* ── Identity ── */}
          <div className="gov-card space-y-4">
            <SectionHeader
              title={t('platform.branding.section.identity')}
              icon={<Landmark className="h-4 w-4" />}
              open={open.identity}
              onToggle={() => toggleSection('identity')}
            />
            {open.identity && (
              <div className="space-y-4">
                <ImageUploadCropper
                  label={t('platform.branding.logoUrl')}
                  hint={t('platform.branding.logoUrl.hint')}
                  value={(val('logoUrl') as string) || branding?.logoUrl}
                  onCropped={uploadLogo}
                  onRemove={removeLogo}
                  aspect={1}
                  circular={false}
                  previewSize={72}
                />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t('platform.branding.platformName')}>
                  <input className="input-gov" value={val('platformName') as string} onChange={(e) => set('platformName', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.platformNameAr')}>
                  <input className="input-gov text-right" dir="rtl" value={val('platformNameAr') as string} onChange={(e) => set('platformNameAr', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.platformNameFr')}>
                  <input className="input-gov" value={val('platformNameFr') as string} onChange={(e) => set('platformNameFr', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.platformDescription')}>
                  <textarea className="input-gov resize-none" rows={2} value={val('platformDescription') as string} onChange={(e) => set('platformDescription', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.platformDescriptionAr')}>
                  <textarea className="input-gov resize-none text-right" dir="rtl" rows={2} value={val('platformDescriptionAr') as string} onChange={(e) => set('platformDescriptionAr', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.platformDescriptionFr')}>
                  <textarea className="input-gov resize-none" rows={2} value={val('platformDescriptionFr') as string} onChange={(e) => set('platformDescriptionFr', e.target.value)} />
                </Field>
              </div>
              </div>
            )}
          </div>

          {/* ── Hero / Banner ── */}
          <div className="gov-card space-y-4">
            <SectionHeader
              title={t('platform.branding.section.hero')}
              icon={<ImageIcon className="h-4 w-4" />}
              open={open.hero}
              onToggle={() => toggleSection('hero')}
            />
            {open.hero && (
              <div className="space-y-4">
                <ImageUploadCropper
                  label={t('platform.branding.bannerImageUrl')}
                  hint={t('platform.branding.bannerImageUrl.hint')}
                  value={(val('bannerImageUrl') as string) || branding?.bannerImageUrl}
                  onCropped={uploadBanner}
                  onRemove={removeBanner}
                  aspect={16 / 6}
                  circular={false}
                  previewSize={120}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('platform.branding.overlayColor')}>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="h-9 w-14 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
                        value={(val('bannerOverlayColor') as string) || '#0c1a2e'}
                        onChange={(e) => set('bannerOverlayColor', e.target.value)}
                      />
                      <input
                        className="input-gov flex-1"
                        placeholder="#0c1a2e"
                        value={val('bannerOverlayColor') as string}
                        onChange={(e) => set('bannerOverlayColor', e.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label={`${t('platform.branding.overlayOpacity')} (0–1)`}>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      className="input-gov"
                      value={val('bannerOverlayOpacity') as string}
                      onChange={(e) => set('bannerOverlayOpacity', parseFloat(e.target.value))}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* ── Operator / Ministry ── */}
          <div className="gov-card space-y-4">
            <SectionHeader
              title={t('platform.branding.section.operator')}
              icon={<Building2 className="h-4 w-4" />}
              open={open.operator}
              onToggle={() => toggleSection('operator')}
            />
            {open.operator && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t('platform.branding.operatorName')}>
                  <input className="input-gov" value={val('operatorName') as string} onChange={(e) => set('operatorName', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.operatorNameAr')}>
                  <input className="input-gov text-right" dir="rtl" value={val('operatorNameAr') as string} onChange={(e) => set('operatorNameAr', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.operatorNameFr')}>
                  <input className="input-gov" value={val('operatorNameFr') as string} onChange={(e) => set('operatorNameFr', e.target.value)} />
                </Field>
              </div>
            )}
          </div>

          {/* ── Contact ── */}
          <div className="gov-card space-y-4">
            <SectionHeader
              title={t('platform.branding.section.contact')}
              icon={<Phone className="h-4 w-4" />}
              open={open.contact}
              onToggle={() => toggleSection('contact')}
            />
            {open.contact && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('platform.branding.supportEmail')}>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                    <input className="input-gov ps-8" type="email" value={val('supportEmail') as string} onChange={(e) => set('supportEmail', e.target.value)} />
                  </div>
                </Field>
                <Field label={t('platform.branding.supportPhone')}>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                    <input className="input-gov ps-8" type="tel" value={val('supportPhone') as string} onChange={(e) => set('supportPhone', e.target.value)} />
                  </div>
                </Field>
                <Field label={t('platform.branding.supportWhatsApp')}>
                  <input className="input-gov" type="tel" value={val('supportWhatsApp') as string} onChange={(e) => set('supportWhatsApp', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.officeAddress')}>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                    <input className="input-gov ps-8" value={val('officeAddress') as string} onChange={(e) => set('officeAddress', e.target.value)} />
                  </div>
                </Field>
                <Field label={t('platform.branding.officeAddressAr')}>
                  <input className="input-gov text-right" dir="rtl" value={val('officeAddressAr') as string} onChange={(e) => set('officeAddressAr', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.officeAddressFr')}>
                  <input className="input-gov" value={val('officeAddressFr') as string} onChange={(e) => set('officeAddressFr', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.openingHours')}>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                    <input className="input-gov ps-8" value={val('openingHours') as string} onChange={(e) => set('openingHours', e.target.value)} />
                  </div>
                </Field>
                <Field label={t('platform.branding.openingHoursAr')}>
                  <input className="input-gov text-right" dir="rtl" value={val('openingHoursAr') as string} onChange={(e) => set('openingHoursAr', e.target.value)} />
                </Field>
                <Field label={t('platform.branding.openingHoursFr')}>
                  <input className="input-gov" value={val('openingHoursFr') as string} onChange={(e) => set('openingHoursFr', e.target.value)} />
                </Field>
              </div>
            )}
          </div>

          {/* ── App Downloads ── */}
          <div className="gov-card space-y-4">
            <SectionHeader
              title={t('platform.branding.section.apps')}
              icon={<Smartphone className="h-4 w-4" />}
              open={open.apps}
              onToggle={() => toggleSection('apps')}
            />
            {open.apps && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t('platform.branding.appStoreUrl')}>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                    <input className="input-gov ps-8" placeholder="https://apps.apple.com/..." value={val('appStoreUrl') as string} onChange={(e) => set('appStoreUrl', e.target.value)} />
                  </div>
                </Field>
                <Field label={t('platform.branding.googlePlayUrl')}>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                    <input className="input-gov ps-8" placeholder="https://play.google.com/..." value={val('googlePlayUrl') as string} onChange={(e) => set('googlePlayUrl', e.target.value)} />
                  </div>
                </Field>
                <Field label={t('platform.branding.apkUrl')}>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                    <input className="input-gov ps-8" placeholder="https://..." value={val('apkUrl') as string} onChange={(e) => set('apkUrl', e.target.value)} />
                  </div>
                </Field>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky save bar — only when there are unsaved changes */}
      {dirtyCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-300 bg-amber-50/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <p className="text-xs font-semibold text-amber-900">
              {t('platform.branding.unsaved', { n: String(dirtyCount) })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm({})}
                className="btn-gov-secondary text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                className="btn-gov-primary text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMut.isPending ? t('common.loading') : t('platform.branding.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
