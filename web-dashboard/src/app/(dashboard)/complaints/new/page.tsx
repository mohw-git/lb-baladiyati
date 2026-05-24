'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { complaintsApi, categoriesApi, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import {
  ArrowLeft,
  MapPin,
  Camera,
  X,
  Loader2,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { useTranslate, useLocale, isRtl, pickName } from '@/lib/i18n';

const MAX_FILES = 5;
const MAX_TOTAL_MB = 25;

export default function NewComplaintPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);

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

  const verificationStatus = (user as any)?.verificationStatus;
  const requiresVerification = verificationStatus && verificationStatus !== 'VERIFIED';

  const { data: categoriesRaw } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });
  const categories: { id: string; name: string }[] = Array.isArray(categoriesRaw)
    ? (categoriesRaw as any)
    : ((categoriesRaw as any)?.data ?? []);

  const submitMutation = useMutation({
    mutationFn: () =>
      complaintsApi.create(
        {
          categoryId: form.categoryId,
          title: form.title.trim(),
          description: form.description.trim(),
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
          address: form.address.trim() || undefined,
        },
        files,
      ),
    onSuccess: (res: any) => {
      toast.success(t('complaints.new.toast.submitted'));
      qc.invalidateQueries({ queryKey: ['complaints'] });
      router.replace(`/complaints/${res.id}`);
    },
    onError: (err: ApiError) => {
      const msg = err?.details?.length
        ? err.details.map((d: any) => `• ${d.message}`).join('\n')
        : err.message;
      toast.error(msg || t('common.error'));
    },
  });

  const onPickFiles = async (selected: FileList | null) => {
    if (!selected) return;
    const incoming = Array.from(selected).filter((f) => f.type.startsWith('image/'));
    if (files.length + incoming.length > MAX_FILES) {
      toast.error(t('upload.error.tooMany' as any) || `Max ${MAX_FILES} photos`);
      return;
    }
    // Reject any single file > 10MB pre-compression.
    const oversize = incoming.find((f) => f.size > 10 * 1024 * 1024);
    if (oversize) {
      toast.error(t('upload.error.tooLarge'));
      return;
    }
    // Compress before upload — saves bandwidth and helps stay under
    // the backend ceiling. Falls back to originals on any failure.
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
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
      },
      () => toast.error(t('common.error')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const canSubmit =
    !!form.categoryId &&
    form.title.trim().length >= 5 &&
    form.description.trim().length >= 10 &&
    !submitMutation.isPending;

  if (requiresVerification) {
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
                {t('complaints.new.kycRequired')}
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                {t('complaints.new.kycRequired.desc')}
              </p>
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
        <h1 className="text-xl font-bold text-gray-900">{t('complaints.new.title')}</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) submitMutation.mutate();
        }}
        className="gov-card space-y-3 p-4"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('common.category')} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="select-gov"
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pickName(c as any, locale)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('common.title')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            minLength={5}
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('complaints.new.field.title.placeholder')}
            className="input-gov"
          />
          <p className="mt-1 text-xs text-gray-400">{form.title.length}/200</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('common.description')} <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('complaints.new.field.description.placeholder')}
            className="input-gov"
          />
          <p className="mt-1 text-xs text-gray-400">{form.description.length}/2000</p>
        </div>

        <div className="rounded border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{t('common.address')}</label>
            <button
              type="button"
              onClick={useMyLocation}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              <MapPin className="h-3.5 w-3.5" /> {t('common.address')}
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
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              placeholder="lat"
              className="input-gov"
            />
            <input
              type="text"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              placeholder="lng"
              className="input-gov"
            />
          </div>
        </div>

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
          <Link
            href="/complaints"
            className="btn-gov-secondary"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-gov-primary"
          >
            {submitMutation.isPending ? (
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
