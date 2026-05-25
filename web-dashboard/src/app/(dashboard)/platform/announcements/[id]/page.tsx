'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Archive,
  ExternalLink,
} from 'lucide-react';
import { platformAnnouncementsApi } from '@/lib/api/endpoints/platform-announcements';
import {
  PlatformAnnouncementForm,
  announcementToForm,
  toFormPayload,
} from '@/components/platform/platform-announcement-form';
import { AnnouncementsCarousel } from '@/components/public/announcements-carousel';
import { useTranslate, useLocale } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

export default function EditPlatformAnnouncementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const [form, setForm] = useState(announcementToForm({
    title: '',
    summary: '',
    content: '',
    isPinned: false,
    priority: 0,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['platform-announcement-admin', id],
    queryFn: () => platformAnnouncementsApi.getAdmin(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (item) setForm(announcementToForm(item));
  }, [item]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!form.title.trim() || !form.summary.trim() || !form.content.trim()) {
        const e: Record<string, string> = {};
        if (!form.title.trim()) e.title = t('platform.announcements.validation.titleRequired');
        if (!form.summary.trim()) e.summary = t('platform.announcements.validation.summaryRequired');
        if (!form.content.trim()) e.content = t('platform.announcements.validation.contentRequired');
        setErrors(e);
        throw new Error('validation');
      }
      setErrors({});
      return platformAnnouncementsApi.update(id, toFormPayload(form));
    },
    onSuccess: () => {
      toast.success(t('platform.announcements.toast.updated'));
      qc.invalidateQueries({ queryKey: ['platform-announcement-admin', id] });
      qc.invalidateQueries({ queryKey: ['platform-announcements-admin'] });
    },
    onError: (err: ApiError | Error) => {
      if (err.message !== 'validation') toast.error((err as ApiError).message || t('common.error'));
    },
  });

  const publishMut = useMutation({
    mutationFn: () => platformAnnouncementsApi.publish(id),
    onSuccess: () => {
      toast.success(t('platform.announcements.toast.published'));
      qc.invalidateQueries({ queryKey: ['platform-announcement-admin', id] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const unpublishMut = useMutation({
    mutationFn: () => platformAnnouncementsApi.unpublish(id),
    onSuccess: () => {
      toast.success(t('platform.announcements.toast.unpublished'));
      qc.invalidateQueries({ queryKey: ['platform-announcement-admin', id] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: () => platformAnnouncementsApi.archive(id),
    onSuccess: () => {
      toast.success(t('platform.announcements.toast.archived'));
      router.push('/platform/announcements');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => platformAnnouncementsApi.uploadImage(id, file),
    onSuccess: (saved) => {
      setForm((f) => ({ ...f, imageUrl: saved.imageUrl || '' }));
      toast.success(t('platform.announcements.toast.imageUploaded'));
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  if (isLoading || !item) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const previewItem = {
    ...item,
    title: form.title,
    titleAr: form.titleAr,
    titleFr: form.titleFr,
    summary: form.summary,
    summaryAr: form.summaryAr,
    summaryFr: form.summaryFr,
    imageUrl: form.imageUrl,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/platform/announcements" className="text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('platform.announcements.edit')}</h1>
            <p className="text-xs text-gray-500">{item.status}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-gov-secondary text-xs"
            onClick={() => setShowPreview((v) => !v)}
          >
            <Eye className="h-3.5 w-3.5" />
            {t('platform.announcements.preview')}
          </button>
          {item.status === 'PUBLISHED' ? (
            <>
              <Link
                href={`/announcements/${id}`}
                target="_blank"
                className="btn-gov-secondary text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('platform.announcements.viewPublic')}
              </Link>
              <button
                type="button"
                className="btn-gov-secondary text-xs"
                onClick={() => unpublishMut.mutate()}
                disabled={unpublishMut.isPending}
              >
                <EyeOff className="h-3.5 w-3.5" />
                {t('platform.announcements.unpublish')}
              </button>
            </>
          ) : item.status !== 'ARCHIVED' ? (
            <button
              type="button"
              className="btn-gov-primary text-xs"
              onClick={() => publishMut.mutate()}
              disabled={publishMut.isPending}
            >
              {t('platform.announcements.publish')}
            </button>
          ) : null}
          {item.status !== 'ARCHIVED' ? (
            <button
              type="button"
              className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50"
              onClick={() => archiveMut.mutate()}
              disabled={archiveMut.isPending}
            >
              <Archive className="h-3.5 w-3.5" />
              {t('platform.announcements.archive')}
            </button>
          ) : null}
        </div>
      </div>

      {showPreview ? (
        <div className="gov-card p-4">
          <p className="mb-3 text-sm font-semibold text-gray-700">{t('platform.announcements.preview')}</p>
          <AnnouncementsCarousel
            items={[previewItem]}
            locale={locale}
            readMoreLabel={t('public.announcements.readMore')}
          />
        </div>
      ) : null}

      <PlatformAnnouncementForm
        form={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        errors={errors}
        onImageCropped={(file) => uploadMut.mutate(file)}
        onImageRemove={() => setForm((f) => ({ ...f, imageUrl: '' }))}
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn-gov-primary"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
