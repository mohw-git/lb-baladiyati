'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  platformApi,
  PlatformBranding,
  UpdatePlatformBrandingRequest,
} from '@/lib/api/endpoints/platform';
import { useTranslate, useLocale } from '@/lib/i18n';
import { toast } from 'sonner';
import { ImageUploadCropper } from '@/components/ui/image-upload-cropper';
import { BrandHeader } from '@/components/brand/brand-header';
import { BannerFocalControl } from '@/components/brand/banner-focal-control';
import { HomepageHeroPreview } from '@/components/brand/homepage-hero-preview';
import { AuthBackgroundPreview } from '@/components/brand/auth-background-preview';
import {
  AUTH_BACKGROUND_CROP_ASPECT,
  DEFAULT_AUTH_BACKGROUND_OVERLAY_OPACITY,
  resolveAuthPageBackground,
} from '@/lib/platform-branding';
import {
  DEFAULT_BANNER_FOCAL,
  DEFAULT_BANNER_OVERLAY_COLOR,
  DEFAULT_BANNER_OVERLAY_OPACITY,
  DEFAULT_PRIMARY_COLOR,
  HERO_BANNER_CROP_ASPECT,
  normalizeBannerFocal,
  normalizeOverlayOpacity,
  sanitizeHexColor,
} from '@/lib/municipality-branding';
import {
  Landmark,
  Save,
  Phone,
  Mail,
  MapPin,
  Clock,
  Smartphone,
  Globe,
  Building2,
  Palette,
  Loader2,
  Image,
  Info,
  KeyRound,
} from 'lucide-react';

type PlatformBrandingForm = {
  platformName: string;
  platformNameAr: string;
  platformNameFr: string;
  platformDescription: string;
  platformDescriptionAr: string;
  platformDescriptionFr: string;
  logoUrl: string;
  bannerImageUrl: string;
  bannerOverlayColor: string;
  bannerOverlayOpacity: number;
  bannerFocalX: number;
  bannerFocalY: number;
  authBackgroundImageUrl: string;
  authBackgroundFocalX: number;
  authBackgroundFocalY: number;
  authBackgroundOverlayOpacity: number;
  operatorName: string;
  operatorNameAr: string;
  operatorNameFr: string;
  supportEmail: string;
  supportPhone: string;
  supportWhatsApp: string;
  officeAddress: string;
  officeAddressAr: string;
  officeAddressFr: string;
  openingHours: string;
  openingHoursAr: string;
  openingHoursFr: string;
  appStoreUrl: string;
  googlePlayUrl: string;
  apkUrl: string;
};

const EMPTY_FORM: PlatformBrandingForm = {
  platformName: '',
  platformNameAr: '',
  platformNameFr: '',
  platformDescription: '',
  platformDescriptionAr: '',
  platformDescriptionFr: '',
  logoUrl: '',
  bannerImageUrl: '',
  bannerOverlayColor: DEFAULT_BANNER_OVERLAY_COLOR,
  bannerOverlayOpacity: DEFAULT_BANNER_OVERLAY_OPACITY,
  bannerFocalX: DEFAULT_BANNER_FOCAL,
  bannerFocalY: DEFAULT_BANNER_FOCAL,
  authBackgroundImageUrl: '',
  authBackgroundFocalX: DEFAULT_BANNER_FOCAL,
  authBackgroundFocalY: DEFAULT_BANNER_FOCAL,
  authBackgroundOverlayOpacity: DEFAULT_AUTH_BACKGROUND_OVERLAY_OPACITY,
  operatorName: '',
  operatorNameAr: '',
  operatorNameFr: '',
  supportEmail: '',
  supportPhone: '',
  supportWhatsApp: '',
  officeAddress: '',
  officeAddressAr: '',
  officeAddressFr: '',
  openingHours: '',
  openingHoursAr: '',
  openingHoursFr: '',
  appStoreUrl: '',
  googlePlayUrl: '',
  apkUrl: '',
};

function brandingToForm(b: PlatformBranding): PlatformBrandingForm {
  return {
    platformName: b.platformName || '',
    platformNameAr: b.platformNameAr || '',
    platformNameFr: b.platformNameFr || '',
    platformDescription: b.platformDescription || '',
    platformDescriptionAr: b.platformDescriptionAr || '',
    platformDescriptionFr: b.platformDescriptionFr || '',
    logoUrl: b.logoUrl || '',
    bannerImageUrl: b.bannerImageUrl || '',
    bannerOverlayColor: sanitizeHexColor(
      b.bannerOverlayColor,
      DEFAULT_BANNER_OVERLAY_COLOR,
    ),
    bannerOverlayOpacity: normalizeOverlayOpacity(b.bannerOverlayOpacity),
    bannerFocalX: normalizeBannerFocal(b.bannerFocalX),
    bannerFocalY: normalizeBannerFocal(b.bannerFocalY),
    authBackgroundImageUrl: b.authBackgroundImageUrl || '',
    authBackgroundFocalX: normalizeBannerFocal(b.authBackgroundFocalX),
    authBackgroundFocalY: normalizeBannerFocal(b.authBackgroundFocalY),
    authBackgroundOverlayOpacity: normalizeOverlayOpacity(
      b.authBackgroundOverlayOpacity,
      DEFAULT_AUTH_BACKGROUND_OVERLAY_OPACITY,
    ),
    operatorName: b.operatorName || '',
    operatorNameAr: b.operatorNameAr || '',
    operatorNameFr: b.operatorNameFr || '',
    supportEmail: b.supportEmail || '',
    supportPhone: b.supportPhone || '',
    supportWhatsApp: b.supportWhatsApp || '',
    officeAddress: b.officeAddress || '',
    officeAddressAr: b.officeAddressAr || '',
    officeAddressFr: b.officeAddressFr || '',
    openingHours: b.openingHours || '',
    openingHoursAr: b.openingHoursAr || '',
    openingHoursFr: b.openingHoursFr || '',
    appStoreUrl: b.appStoreUrl || '',
    googlePlayUrl: b.googlePlayUrl || '',
    apkUrl: b.apkUrl || '',
  };
}

function formToPayload(form: PlatformBrandingForm): UpdatePlatformBrandingRequest {
  return {
    platformName: form.platformName || undefined,
    platformNameAr: form.platformNameAr || undefined,
    platformNameFr: form.platformNameFr || undefined,
    platformDescription: form.platformDescription || undefined,
    platformDescriptionAr: form.platformDescriptionAr || undefined,
    platformDescriptionFr: form.platformDescriptionFr || undefined,
    logoUrl: form.logoUrl || undefined,
    bannerImageUrl: form.bannerImageUrl || undefined,
    bannerOverlayColor: form.bannerImageUrl
      ? sanitizeHexColor(form.bannerOverlayColor, DEFAULT_BANNER_OVERLAY_COLOR)
      : undefined,
    bannerOverlayOpacity: form.bannerImageUrl
      ? normalizeOverlayOpacity(form.bannerOverlayOpacity)
      : undefined,
    bannerFocalX: form.bannerImageUrl
      ? normalizeBannerFocal(form.bannerFocalX)
      : undefined,
    bannerFocalY: form.bannerImageUrl
      ? normalizeBannerFocal(form.bannerFocalY)
      : undefined,
    authBackgroundImageUrl: form.authBackgroundImageUrl || undefined,
    authBackgroundFocalX: form.authBackgroundImageUrl
      ? normalizeBannerFocal(form.authBackgroundFocalX)
      : undefined,
    authBackgroundFocalY: form.authBackgroundImageUrl
      ? normalizeBannerFocal(form.authBackgroundFocalY)
      : undefined,
    authBackgroundOverlayOpacity: form.authBackgroundImageUrl
      ? normalizeOverlayOpacity(form.authBackgroundOverlayOpacity)
      : undefined,
    operatorName: form.operatorName || undefined,
    operatorNameAr: form.operatorNameAr || undefined,
    operatorNameFr: form.operatorNameFr || undefined,
    supportEmail: form.supportEmail || undefined,
    supportPhone: form.supportPhone || undefined,
    supportWhatsApp: form.supportWhatsApp || undefined,
    officeAddress: form.officeAddress || undefined,
    officeAddressAr: form.officeAddressAr || undefined,
    officeAddressFr: form.officeAddressFr || undefined,
    openingHours: form.openingHours || undefined,
    openingHoursAr: form.openingHoursAr || undefined,
    openingHoursFr: form.openingHoursFr || undefined,
    appStoreUrl: form.appStoreUrl || undefined,
    googlePlayUrl: form.googlePlayUrl || undefined,
    apkUrl: form.apkUrl || undefined,
  };
}

export default function PlatformBrandingPage() {
  const t = useTranslate();
  const locale = useLocale();
  const qc = useQueryClient();
  const dirtyRef = useRef(false);

  const { data: branding, isPending } = useQuery({
    queryKey: ['platform-branding'],
    queryFn: () => platformApi.getBranding(),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  const [form, setForm] = useState<PlatformBrandingForm>(() => {
    const cached = qc.getQueryData<PlatformBranding>(['platform-branding']);
    return cached ? brandingToForm(cached) : EMPTY_FORM;
  });

  useLayoutEffect(() => {
    if (!branding || dirtyRef.current) return;
    setForm(brandingToForm(branding));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when server record changes, not on every refetch identity
  }, [branding?.updatedAt]);

  const updateForm = (patch: Partial<PlatformBrandingForm>) => {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const saveMut = useMutation({
    mutationFn: () => platformApi.updateBranding(formToPayload(form)),
    onSuccess: (saved) => {
      dirtyRef.current = false;
      qc.setQueryData(['platform-branding'], saved);
      qc.invalidateQueries({ queryKey: ['public-platform-branding'] });
      setForm(brandingToForm(saved));
      toast.success(t('platform.branding.saved'));
    },
    onError: () => toast.error(t('common.error')),
  });

  const refreshMedia = (saved: PlatformBranding) => {
    qc.setQueryData(['platform-branding'], saved);
    qc.invalidateQueries({ queryKey: ['public-platform-branding'] });
    setForm((prev) => ({
      ...prev,
      logoUrl: saved.logoUrl || '',
      bannerImageUrl: saved.bannerImageUrl || '',
      bannerOverlayColor: sanitizeHexColor(
        saved.bannerOverlayColor,
        prev.bannerOverlayColor,
      ),
      bannerOverlayOpacity: normalizeOverlayOpacity(saved.bannerOverlayOpacity),
      bannerFocalX: normalizeBannerFocal(saved.bannerFocalX, prev.bannerFocalX),
      bannerFocalY: normalizeBannerFocal(saved.bannerFocalY, prev.bannerFocalY),
      authBackgroundImageUrl: saved.authBackgroundImageUrl || '',
      authBackgroundFocalX: normalizeBannerFocal(
        saved.authBackgroundFocalX,
        prev.authBackgroundFocalX,
      ),
      authBackgroundFocalY: normalizeBannerFocal(
        saved.authBackgroundFocalY,
        prev.authBackgroundFocalY,
      ),
      authBackgroundOverlayOpacity: normalizeOverlayOpacity(
        saved.authBackgroundOverlayOpacity,
        prev.authBackgroundOverlayOpacity,
      ),
    }));
  };

  const uploadLogo = async (file: File) => {
    try {
      const saved = await platformApi.uploadBrandingLogo(file);
      refreshMedia(saved);
      toast.success(t('upload.success'));
    } catch {
      toast.error(t('upload.error.uploadFailed'));
      throw new Error('upload_failed');
    }
  };

  const uploadBanner = async (file: File) => {
    try {
      const saved = await platformApi.uploadBrandingBanner(file);
      refreshMedia(saved);
      toast.success(t('upload.success'));
    } catch {
      toast.error(t('upload.error.uploadFailed'));
      throw new Error('upload_failed');
    }
  };

  const removeLogo = async () => {
    const saved = await platformApi.updateBranding({ logoUrl: null as never });
    refreshMedia(saved);
    toast.success(t('upload.removed'));
  };

  const removeBanner = async () => {
    const saved = await platformApi.updateBranding({ bannerImageUrl: null as never });
    refreshMedia(saved);
    toast.success(t('upload.removed'));
  };

  const uploadAuthBackground = async (file: File) => {
    try {
      const saved = await platformApi.uploadBrandingAuthBackground(file);
      refreshMedia(saved);
      toast.success(t('upload.success'));
    } catch {
      toast.error(t('upload.error.uploadFailed'));
      throw new Error('upload_failed');
    }
  };

  const removeAuthBackground = async () => {
    const saved = await platformApi.updateBranding({ authBackgroundImageUrl: null as never });
    refreshMedia(saved);
    toast.success(t('upload.removed'));
  };

  const localizedName =
    (locale === 'ar' && form.platformNameAr) ||
    (locale === 'fr' && form.platformNameFr) ||
    form.platformName ||
    branding?.platformName ||
    'Baladi';

  const localizedDescription =
    (locale === 'ar' && form.platformDescriptionAr) ||
    (locale === 'fr' && form.platformDescriptionFr) ||
    form.platformDescription ||
    '';

  const authPreviewBg = resolveAuthPageBackground({
    authBackgroundImageUrl: form.authBackgroundImageUrl || null,
    bannerImageUrl: form.bannerImageUrl || null,
    authBackgroundFocalX: form.authBackgroundFocalX,
    authBackgroundFocalY: form.authBackgroundFocalY,
    bannerFocalX: form.bannerFocalX,
    bannerFocalY: form.bannerFocalY,
    authBackgroundOverlayOpacity: form.authBackgroundOverlayOpacity,
    bannerOverlayOpacity: form.bannerOverlayOpacity,
    bannerOverlayColor: form.bannerOverlayColor,
  });

  if (isPending && !branding) {
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
            <Landmark className="h-5 w-5" />
            {t('platform.branding.title')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('platform.branding.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="btn-gov-primary"
        >
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('platform.branding.save')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Identity */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Globe className="h-4 w-4" />
              {t('platform.branding.section.identity')}
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.platformName')}
                </label>
                <input
                  className="input-gov"
                  value={form.platformName}
                  onChange={(e) => updateForm({ platformName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('platform.branding.platformNameAr')}
                  </label>
                  <input
                    className="input-gov text-right"
                    dir="rtl"
                    value={form.platformNameAr}
                    onChange={(e) => updateForm({ platformNameAr: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('platform.branding.platformNameFr')}
                  </label>
                  <input
                    className="input-gov"
                    value={form.platformNameFr}
                    onChange={(e) => updateForm({ platformNameFr: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.platformDescription')}
                </label>
                <textarea
                  className="input-gov resize-none"
                  rows={2}
                  value={form.platformDescription}
                  onChange={(e) =>
                    updateForm({ platformDescription: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('platform.branding.platformDescriptionAr')}
                  </label>
                  <textarea
                    className="input-gov resize-none text-right"
                    dir="rtl"
                    rows={2}
                    value={form.platformDescriptionAr}
                    onChange={(e) =>
                      updateForm({ platformDescriptionAr: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('platform.branding.platformDescriptionFr')}
                  </label>
                  <textarea
                    className="input-gov resize-none"
                    rows={2}
                    value={form.platformDescriptionFr}
                    onChange={(e) =>
                      updateForm({ platformDescriptionFr: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Visual branding */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Palette className="h-4 w-4" />
              {t('platform.branding.section.branding')}
            </div>
            <div className="mt-3 space-y-4">
              <div className="rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-950">
                <div className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                  <p>{t('platform.branding.visualGuide')}</p>
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-semibold text-gray-800">
                  {t('platform.branding.logoRole')}
                </p>
                <p className="mt-1 text-xs text-gray-600">{t('platform.branding.logoUrl.hint')}</p>
                <p className="mt-1 text-[11px] text-gray-500">{t('platform.branding.logoSizeHint')}</p>
              </div>
              <ImageUploadCropper
                label={t('platform.branding.logoUrl')}
                hint={t('platform.branding.logoUrl.shortHint')}
                value={form.logoUrl}
                onCropped={uploadLogo}
                onRemove={removeLogo}
                aspect={1}
                circular={false}
                previewSize={72}
              />

              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-semibold text-gray-800">
                  {t('platform.branding.bannerRole')}
                </p>
                <p className="mt-1 text-xs text-gray-600">{t('platform.branding.bannerImageUrl.hint')}</p>
                <p className="mt-1 text-[11px] text-gray-500">{t('platform.branding.bannerSizeHint')}</p>
                <p className="mt-1 text-[11px] font-medium text-amber-800">
                  {t('platform.branding.bannerAvoidHint')}
                </p>
              </div>
              <ImageUploadCropper
                label={t('platform.branding.bannerImageUrl')}
                hint={t('platform.branding.bannerImageUrl.shortHint')}
                value={form.bannerImageUrl}
                onCropped={uploadBanner}
                onRemove={removeBanner}
                aspect={HERO_BANNER_CROP_ASPECT}
                circular={false}
                previewSize={140}
              />
              {form.bannerImageUrl ? (
                <>
                <BannerFocalControl
                  bannerImageUrl={form.bannerImageUrl}
                  focalX={form.bannerFocalX}
                  focalY={form.bannerFocalY}
                  onChange={(bannerFocalX, bannerFocalY) =>
                    updateForm({ bannerFocalX, bannerFocalY })
                  }
                  labels={{
                    title: t('platform.branding.focal.title'),
                    hint: t('platform.branding.focal.hint'),
                    horizontal: t('platform.branding.focal.horizontal'),
                    vertical: t('platform.branding.focal.vertical'),
                    center: t('platform.branding.focal.center'),
                    top: t('platform.branding.focal.top'),
                    bottom: t('platform.branding.focal.bottom'),
                    left: t('platform.branding.focal.left'),
                    right: t('platform.branding.focal.right'),
                  }}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('platform.branding.overlayColor')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.bannerOverlayColor}
                        onChange={(e) =>
                          updateForm({ bannerOverlayColor: e.target.value })
                        }
                        className="h-9 w-14 cursor-pointer rounded border border-gray-300 p-0.5"
                      />
                      <input
                        type="text"
                        value={form.bannerOverlayColor}
                        onChange={(e) =>
                          updateForm({ bannerOverlayColor: e.target.value })
                        }
                        maxLength={7}
                        className="input-gov w-32 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('platform.branding.overlayOpacity', {
                        percent: Math.round(form.bannerOverlayOpacity * 100),
                      })}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={form.bannerOverlayOpacity}
                      onChange={(e) =>
                        updateForm({
                          bannerOverlayOpacity: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Auth pages background */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <KeyRound className="h-4 w-4" />
              {t('platform.branding.section.authBackground')}
            </div>
            <div className="mt-3 space-y-4">
              <p className="text-xs text-gray-600">{t('platform.branding.authBackground.desc')}</p>
              <p className="text-[11px] text-gray-500">{t('platform.branding.authBackground.sizeHint')}</p>
              <p className="text-[11px] font-medium text-amber-800">
                {t('platform.branding.authBackground.calmHint')}
              </p>
              {!form.authBackgroundImageUrl ? (
                <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {t('platform.branding.authBackground.fallbackNote')}
                </p>
              ) : null}

              <ImageUploadCropper
                label={t('platform.branding.authBackground.image')}
                hint={t('platform.branding.authBackground.imageHint')}
                value={form.authBackgroundImageUrl}
                onCropped={uploadAuthBackground}
                onRemove={removeAuthBackground}
                aspect={AUTH_BACKGROUND_CROP_ASPECT}
                circular={false}
                previewSize={120}
              />

              {form.authBackgroundImageUrl ? (
                <>
                  <BannerFocalControl
                    bannerImageUrl={form.authBackgroundImageUrl}
                    focalX={form.authBackgroundFocalX}
                    focalY={form.authBackgroundFocalY}
                    onChange={(authBackgroundFocalX, authBackgroundFocalY) =>
                      updateForm({ authBackgroundFocalX, authBackgroundFocalY })
                    }
                    labels={{
                      title: t('platform.branding.authBackground.focal.title'),
                      hint: t('platform.branding.authBackground.focal.hint'),
                      horizontal: t('platform.branding.focal.horizontal'),
                      vertical: t('platform.branding.focal.vertical'),
                      center: t('platform.branding.focal.center'),
                      top: t('platform.branding.focal.top'),
                      bottom: t('platform.branding.focal.bottom'),
                      left: t('platform.branding.focal.left'),
                      right: t('platform.branding.focal.right'),
                    }}
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('platform.branding.authBackground.darkOverlayOpacity', {
                        percent: Math.round(form.authBackgroundOverlayOpacity * 100),
                      })}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={form.authBackgroundOverlayOpacity}
                      onChange={(e) =>
                        updateForm({
                          authBackgroundOverlayOpacity: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Operator */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Building2 className="h-4 w-4" />
              {t('platform.branding.section.operator')}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.operatorName')}
                </label>
                <input
                  className="input-gov"
                  value={form.operatorName}
                  onChange={(e) => updateForm({ operatorName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.operatorNameAr')}
                </label>
                <input
                  className="input-gov text-right"
                  dir="rtl"
                  value={form.operatorNameAr}
                  onChange={(e) => updateForm({ operatorNameAr: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.operatorNameFr')}
                </label>
                <input
                  className="input-gov"
                  value={form.operatorNameFr}
                  onChange={(e) => updateForm({ operatorNameFr: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Phone className="h-4 w-4" />
              {t('platform.branding.section.contact')}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.supportEmail')}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    className="input-gov ps-8"
                    value={form.supportEmail}
                    onChange={(e) => updateForm({ supportEmail: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.supportPhone')}
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    className="input-gov ps-8"
                    value={form.supportPhone}
                    onChange={(e) => updateForm({ supportPhone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.supportWhatsApp')}
                </label>
                <input
                  type="tel"
                  className="input-gov"
                  value={form.supportWhatsApp}
                  onChange={(e) => updateForm({ supportWhatsApp: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.officeAddress')}
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input
                    className="input-gov ps-8"
                    value={form.officeAddress}
                    onChange={(e) => updateForm({ officeAddress: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.officeAddressAr')}
                </label>
                <input
                  className="input-gov text-right"
                  dir="rtl"
                  value={form.officeAddressAr}
                  onChange={(e) => updateForm({ officeAddressAr: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.officeAddressFr')}
                </label>
                <input
                  className="input-gov"
                  value={form.officeAddressFr}
                  onChange={(e) => updateForm({ officeAddressFr: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.openingHours')}
                </label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input
                    className="input-gov ps-8"
                    value={form.openingHours}
                    onChange={(e) => updateForm({ openingHours: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.openingHoursAr')}
                </label>
                <input
                  className="input-gov text-right"
                  dir="rtl"
                  value={form.openingHoursAr}
                  onChange={(e) => updateForm({ openingHoursAr: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.openingHoursFr')}
                </label>
                <input
                  className="input-gov"
                  value={form.openingHoursFr}
                  onChange={(e) => updateForm({ openingHoursFr: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* App downloads */}
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Smartphone className="h-4 w-4" />
              {t('platform.branding.section.apps')}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.appStoreUrl')}
                </label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input
                    className="input-gov ps-8"
                    placeholder="https://apps.apple.com/..."
                    value={form.appStoreUrl}
                    onChange={(e) => updateForm({ appStoreUrl: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.googlePlayUrl')}
                </label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input
                    className="input-gov ps-8"
                    placeholder="https://play.google.com/..."
                    value={form.googlePlayUrl}
                    onChange={(e) => updateForm({ googlePlayUrl: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.branding.apkUrl')}
                </label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-gray-400" />
                  <input
                    className="input-gov ps-8"
                    placeholder="https://..."
                    value={form.apkUrl}
                    onChange={(e) => updateForm({ apkUrl: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <div className="gov-card p-4">
            <div className="gov-section-header">
              <Image className="h-4 w-4" />
              {t('platform.branding.preview')}
            </div>
            <p className="mt-1 text-xs text-gray-500">{t('platform.branding.previewNote')}</p>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('platform.branding.previewHomepage')}
              </p>
              <HomepageHeroPreview
                platformName={localizedName}
                platformDescription={localizedDescription}
                officialPortalLabel={t('public.topbar.officialPortal')}
                submitLabel={t('public.hero.submitComplaint')}
                trackLabel={t('public.hero.trackComplaint')}
                emergencyLabel={t('public.hero.emergency')}
                bannerImageUrl={form.bannerImageUrl}
                bannerOverlayColor={form.bannerOverlayColor}
                bannerOverlayOpacity={form.bannerOverlayOpacity}
                bannerFocalX={form.bannerFocalX}
                bannerFocalY={form.bannerFocalY}
              />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('platform.branding.previewAuthBackground')}
              </p>
              <AuthBackgroundPreview
                imageUrl={authPreviewBg.imageUrl}
                overlayColor={authPreviewBg.overlayColor}
                overlayOpacity={authPreviewBg.overlayOpacity}
                focalX={authPreviewBg.focalX}
                focalY={authPreviewBg.focalY}
                loginLabel={t('auth.login.title')}
              />
              {!form.authBackgroundImageUrl ? (
                <p className="mt-1 text-[10px] italic text-gray-500">
                  {t('platform.branding.authBackground.previewUsingBanner')}
                </p>
              ) : null}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('platform.branding.previewSidebar')}
              </p>
              <BrandHeader
                className="rounded"
                variant="sidebar"
                name={localizedName}
                subtitle={t('common.tagline')}
                logoUrl={form.logoUrl}
                bannerImageUrl={form.bannerImageUrl}
                bannerOverlayColor={form.bannerOverlayColor}
                bannerOverlayOpacity={form.bannerOverlayOpacity}
                bannerFocalX={form.bannerFocalX}
                bannerFocalY={form.bannerFocalY}
                primaryColor={DEFAULT_PRIMARY_COLOR}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
