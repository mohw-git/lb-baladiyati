'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { complaintsApi, categoriesApi, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { PERMISSIONS } from '@shared/constants/permissions';
import {
  ArrowLeft,
  MapPin,
  Camera,
  X,
  Loader2,
  Send,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useTranslate, useLocale, isRtl, pickName } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n/messages';
import type { Locale } from '@shared/types/locale';
import {
  COMPLAINT_FIELD_LIMITS,
  isComplaintDescriptionValid,
  isComplaintTitleValid,
} from '@shared/constants/complaint-fields';

const MAX_FILES = 5;

type MunicipalityCandidate = {
  id: string;
  name: string;
  code: string;
  nameAr?: string;
  nameFr?: string;
};

function formatMunicipalityLabel(c: MunicipalityCandidate, locale: Locale): string {
  const name = pickName(c, locale);
  return c.code ? `${name} (${c.code})` : name;
}

const ROUTING_ERROR_KEYS: Partial<Record<string, MessageKey>> = {
  LOCATION_REQUIRED: 'complaints.new.validation.locationRequired',
  OUT_OF_COVERAGE: 'complaints.new.routing.outOfCoverage',
  MUNICIPALITY_AMBIGUOUS: 'complaints.new.errors.municipalityAmbiguous',
  INVALID_MUNICIPALITY_SELECTION: 'complaints.new.errors.invalidMunicipalitySelection',
  CATEGORY_MUNICIPALITY_MISMATCH: 'complaints.new.errors.categoryMismatch',
};

export default function NewComplaintPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const resolveSeqRef = useRef(0);

  const [form, setForm] = useState({
    categoryId: '',
    title: '',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [operationalMunicipalityId, setOperationalMunicipalityId] = useState<string | undefined>();
  const [resolutionStatus, setResolutionStatus] = useState<string | null>(null);
  const [resolutionCandidates, setResolutionCandidates] = useState<MunicipalityCandidate[]>([]);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState('');
  const [reportingMunicipalityName, setReportingMunicipalityName] = useState<string | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [resolveError, setResolveError] = useState(false);

  const verificationStatus = (user as any)?.verificationStatus;
  const userPerms: string[] = (user as any)?.permissions ?? [];
  const isStaffCreator =
    userPerms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
    userPerms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
    userPerms.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED);
  const allowUnverified =
    (user as { allowUnverifiedCitizenComplaints?: boolean })
      ?.allowUnverifiedCitizenComplaints === true;
  const emailUnverified = user?.emailVerified === false;
  const kycUnverified =
    !!verificationStatus && verificationStatus !== 'VERIFIED';
  const isUnverifiedCitizen =
    !isStaffCreator && (emailUnverified || kycUnverified);
  const blockedByVerification = isUnverifiedCitizen && !allowUnverified;

  const { data: categoriesRaw, isLoading: loadingCategories } = useQuery({
    queryKey: ['categories', operationalMunicipalityId ?? 'home'],
    queryFn: () => categoriesApi.list({ municipalityId: operationalMunicipalityId }),
    enabled: !!operationalMunicipalityId,
  });
  const categories: { id: string; name: string }[] = Array.isArray(categoriesRaw)
    ? (categoriesRaw as any)
    : ((categoriesRaw as any)?.data ?? []);

  const invalidateRouting = useCallback(() => {
    resolveSeqRef.current += 1;
    setResolvingLocation(false);
    setResolveError(false);
    setResolutionStatus(null);
    setOperationalMunicipalityId(undefined);
    setReportingMunicipalityName(null);
    setSelectedMunicipalityId('');
    setResolutionCandidates([]);
    setForm((f) => ({ ...f, categoryId: '' }));
  }, []);

  const resolveIncidentMunicipality = useCallback(
    async (lat: number, lng: number) => {
      const seq = ++resolveSeqRef.current;
      setResolvingLocation(true);
      setResolveError(false);
      try {
        const res = await complaintsApi.resolveLocation(lat, lng);
        if (seq !== resolveSeqRef.current) return;

        setResolutionStatus(res.status);
        setResolutionCandidates((res.candidates ?? []) as MunicipalityCandidate[]);

        if (res.status === 'OUT_OF_COVERAGE') {
          setOperationalMunicipalityId(undefined);
          setReportingMunicipalityName(null);
          setSelectedMunicipalityId('');
          setForm((f) => ({ ...f, categoryId: '' }));
          return;
        }
        if (res.status === 'AMBIGUOUS') {
          setOperationalMunicipalityId(undefined);
          setReportingMunicipalityName(null);
          setSelectedMunicipalityId('');
          setForm((f) => ({ ...f, categoryId: '' }));
          return;
        }
        if (res.municipalityId) {
          setOperationalMunicipalityId(res.municipalityId);
          setSelectedMunicipalityId('');
          const match = (res.candidates as MunicipalityCandidate[] | undefined)?.find(
            (c) => c.id === res.municipalityId,
          );
          setReportingMunicipalityName(match ? pickName(match, locale) : null);
          setForm((f) => ({ ...f, categoryId: '' }));
        }
      } catch {
        if (seq !== resolveSeqRef.current) return;
        setResolveError(true);
        setResolutionStatus(null);
        setOperationalMunicipalityId(undefined);
        setReportingMunicipalityName(null);
        setResolutionCandidates([]);
        setSelectedMunicipalityId('');
        setForm((f) => ({ ...f, categoryId: '' }));
      } finally {
        if (seq === resolveSeqRef.current) {
          setResolvingLocation(false);
        }
      }
    },
    [locale],
  );

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!form.latitude || !form.longitude) {
        throw new Error(t('complaints.new.validation.locationRequired'));
      }
      return complaintsApi.create(
        {
          categoryId: form.categoryId,
          title: form.title.trim(),
          description: form.description.trim(),
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          address: form.address.trim() || undefined,
          selectedMunicipalityId: selectedMunicipalityId || undefined,
        },
        files,
      );
    },
    onSuccess: (res: any) => {
      toast.success(t('complaints.new.toast.submitted'));
      qc.invalidateQueries({ queryKey: ['complaints'] });
      router.replace(`/complaints/${res.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        const key = ROUTING_ERROR_KEYS[err.code];
        if (key) {
          toast.error(t(key));
          return;
        }
        const msg = err?.details?.length
          ? err.details.map((d: { message: string }) => `• ${d.message}`).join('\n')
          : err.message;
        toast.error(msg || t('common.error'));
        return;
      }
      toast.error(err instanceof Error ? err.message : t('common.error'));
    },
  });

  const onPickFiles = async (selected: FileList | null) => {
    if (!selected) return;
    const incoming = Array.from(selected).filter((f) => f.type.startsWith('image/'));
    if (files.length + incoming.length > MAX_FILES) {
      toast.error(t('upload.error.tooMany' as any) || `Max ${MAX_FILES} photos`);
      return;
    }
    const oversize = incoming.find((f) => f.size > 10 * 1024 * 1024);
    if (oversize) {
      toast.error(t('upload.error.tooLarge'));
      return;
    }
    const { compressImages } = await import('@/lib/utils/image-compress');
    const compressed = await compressImages(incoming, { maxLongEdge: 1920, quality: 0.82 });
    const merged = [...files, ...compressed].slice(0, MAX_FILES);
    setFiles(merged);
    setPreviews(merged.map((f) => URL.createObjectURL(f)));
  };

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error(t('common.error'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        invalidateRouting();
        setForm((f) => ({
          ...f,
          latitude: String(lat),
          longitude: String(lng),
        }));
        await resolveIncidentMunicipality(lat, lng);
      },
      () => toast.error(t('common.error')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const retryResolve = () => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      void resolveIncidentMunicipality(lat, lng);
    }
  };

  const hasLocation = !!form.latitude && !!form.longitude;
  const municipalityReady =
    !!operationalMunicipalityId &&
    resolutionStatus !== 'OUT_OF_COVERAGE' &&
    (resolutionStatus !== 'AMBIGUOUS' || !!selectedMunicipalityId);

  const canSubmit =
    hasLocation &&
    !resolvingLocation &&
    !resolveError &&
    municipalityReady &&
    resolutionStatus !== 'OUT_OF_COVERAGE' &&
    !!form.categoryId &&
    isComplaintTitleValid(form.title) &&
    isComplaintDescriptionValid(form.description) &&
    !submitMutation.isPending;

  const titleInvalid = form.title.length > 0 && !isComplaintTitleValid(form.title);
  const descriptionInvalid =
    form.description.length > 0 && !isComplaintDescriptionValid(form.description);

  const pickAmbiguousMunicipality = (c: MunicipalityCandidate) => {
    setSelectedMunicipalityId(c.id);
    setOperationalMunicipalityId(c.id);
    setReportingMunicipalityName(pickName(c, locale));
    setForm((f) => ({ ...f, categoryId: '' }));
  };

  const onCoordinateFieldChange = (field: 'latitude' | 'longitude', value: string) => {
    invalidateRouting();
    setForm((f) => ({ ...f, [field]: value }));
  };

  const tryResolveFromFormCoords = () => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      void resolveIncidentMunicipality(lat, lng);
    }
  };

  const reporterMunicipalityId = (user as { municipalityId?: string })?.municipalityId;

  if (blockedByVerification) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          href="/complaints"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.complaints')}
        </Link>
        <div className="rounded border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-amber-900">
                {kycUnverified
                  ? t('complaints.new.kycRequired')
                  : t('complaints.new.emailRequired')}
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                {kycUnverified
                  ? t('complaints.new.kycRequired.desc')
                  : t('complaints.new.emailRequired.desc')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {kycUnverified && (
                  <Link
                    href="/kyc/submit"
                    className="inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
                  >
                    {t('profile.kyc.submit')}
                  </Link>
                )}
                {emailUnverified && (
                  <Link
                    href="/profile"
                    className="inline-flex rounded-lg border border-amber-700 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                  >
                    {t('auth.unverified.resend')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <Link
          href="/complaints"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.complaints')}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {isStaffCreator ? t('complaints.createOnBehalf') : t('complaints.new.title')}
        </h1>
        {isStaffCreator && (
          <div className="mt-3 flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('complaints.createOnBehalf.notice')}</span>
          </div>
        )}
        {isUnverifiedCitizen && allowUnverified && (
          <div className="mt-3 flex items-start gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <span>{t('complaints.new.unverifiedNotice')}</span>
          </div>
        )}
        <p className="mt-3 text-sm text-gray-600">
          {isStaffCreator
            ? t('complaints.new.routing.locationIntroStaff')
            : t('complaints.new.routing.locationIntro')}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isComplaintTitleValid(form.title)) {
            toast.error(t('complaints.new.validation.titleRange'));
            return;
          }
          if (!isComplaintDescriptionValid(form.description)) {
            toast.error(t('complaints.new.validation.descriptionRange'));
            return;
          }
          if (canSubmit) submitMutation.mutate();
        }}
        className="gov-card space-y-4 p-4"
      >
        {/* 1. Location */}
        <div className="rounded border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {t('common.address')} <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={resolvingLocation}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              {resolvingLocation ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              {t('complaints.new.routing.useMyLocation')}
            </button>
          </div>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder={t('complaints.new.field.address.placeholder')}
            className="input-gov mb-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={form.latitude}
              onChange={(e) => onCoordinateFieldChange('latitude', e.target.value)}
              onBlur={tryResolveFromFormCoords}
              placeholder="lat"
              className="input-gov"
            />
            <input
              type="text"
              required
              value={form.longitude}
              onChange={(e) => onCoordinateFieldChange('longitude', e.target.value)}
              onBlur={tryResolveFromFormCoords}
              placeholder="lng"
              className="input-gov"
            />
          </div>
          {!hasLocation && (
            <p className="mt-2 text-sm text-amber-800">
              {t('complaints.new.validation.locationRequired')}
            </p>
          )}
        </div>

        {/* 2. Municipality confirmation */}
        <div className="space-y-2">
          {!hasLocation && (
            <p className="text-sm text-gray-500">{t('complaints.new.routing.selectLocationFirst')}</p>
          )}

          {hasLocation && resolvingLocation && (
            <div className="flex items-center gap-2 rounded border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              {t('complaints.new.routing.resolving')}
            </div>
          )}

          {hasLocation && resolveError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              <p>{t('complaints.new.routing.resolveFailed')}</p>
              <button
                type="button"
                onClick={retryResolve}
                className="mt-2 text-xs font-medium text-red-800 underline hover:text-red-900"
              >
                {t('complaints.new.routing.retry')}
              </button>
            </div>
          )}

          {resolutionStatus === 'OUT_OF_COVERAGE' && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {t('complaints.new.routing.outOfCoverage')}
            </div>
          )}

          {reportingMunicipalityName && municipalityReady && (
            <div className="rounded border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
              <p className="font-medium">
                {t('complaints.new.routing.reportingTo', { name: reportingMunicipalityName })}
              </p>
              {reporterMunicipalityId &&
                operationalMunicipalityId &&
                reporterMunicipalityId !== operationalMunicipalityId && (
                  <p className="mt-1 text-brand-800">
                    {t('complaints.new.routing.crossMunicipality', {
                      name: reportingMunicipalityName,
                    })}
                  </p>
                )}
            </div>
          )}

          {resolutionStatus === 'AMBIGUOUS' && resolutionCandidates.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">{t('complaints.new.routing.ambiguousTitle')}</p>
              <div className="mt-2 space-y-1">
                {resolutionCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickAmbiguousMunicipality(c)}
                    className={`block w-full rounded border px-3 py-2 text-start text-sm ${
                      selectedMunicipalityId === c.id
                        ? 'border-brand-600 bg-brand-50 font-medium'
                        : 'border-amber-300 bg-white hover:bg-amber-100'
                    }`}
                  >
                    {formatMunicipalityLabel(c, locale)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Category */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('common.category')} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            disabled={!municipalityReady || resolvingLocation || loadingCategories}
            className="select-gov disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            <option value="">
              {!municipalityReady
                ? t('complaints.new.category.locked')
                : loadingCategories
                  ? t('common.loading')
                  : '—'}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pickName(c as any, locale)}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Details */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('common.title')} <span className="text-red-500">*</span>
          </label>
          <p className="mb-1.5 text-xs text-gray-500">{t('complaints.new.field.title.hint')}</p>
          <input
            type="text"
            required
            minLength={COMPLAINT_FIELD_LIMITS.title.min}
            maxLength={COMPLAINT_FIELD_LIMITS.title.max}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('complaints.new.field.title.placeholder')}
            className={`input-gov ${titleInvalid ? 'border-red-300 focus:border-red-500' : ''}`}
          />
          <p className="mt-1 text-xs text-gray-400">
            {t('complaints.new.field.charCount', {
              current: String(form.title.length),
              max: String(COMPLAINT_FIELD_LIMITS.title.max),
            })}
          </p>
          {titleInvalid && (
            <p className="mt-1 text-xs text-red-600">{t('complaints.new.validation.titleRange')}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('common.description')} <span className="text-red-500">*</span>
          </label>
          <p className="mb-1.5 text-xs text-gray-500">{t('complaints.new.field.description.hint')}</p>
          <textarea
            required
            minLength={COMPLAINT_FIELD_LIMITS.description.min}
            maxLength={COMPLAINT_FIELD_LIMITS.description.max}
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('complaints.new.field.description.placeholder')}
            className={`input-gov ${descriptionInvalid ? 'border-red-300 focus:border-red-500' : ''}`}
          />
          <p className="mt-1 text-xs text-gray-400">
            {t('complaints.new.field.charCount', {
              current: String(form.description.length),
              max: String(COMPLAINT_FIELD_LIMITS.description.max),
            })}
          </p>
          {descriptionInvalid && (
            <p className="mt-1 text-xs text-red-600">
              {t('complaints.new.validation.descriptionRange')}
            </p>
          )}
        </div>

        {/* 5. Photos */}
        <div className="rounded border border-gray-200 p-3">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {t('common.attachments')} ({MAX_FILES})
          </label>
          {previews.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {previews.map((src, idx) => (
                <div key={idx} className="relative aspect-square overflow-hidden rounded-lg">
                  <Image
                    src={src}
                    alt={`Preview ${idx + 1}`}
                    fill
                    sizes="120px"
                    unoptimized
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {files.length < MAX_FILES && (
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600">
              <Camera className="h-4 w-4" />
              {t('common.attachments')}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/complaints" className="btn-gov-secondary">
            {t('common.cancel')}
          </Link>
          <button type="submit" disabled={!canSubmit} className="btn-gov-primary">
            {submitMutation.isPending || resolvingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('complaints.new.btn.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
