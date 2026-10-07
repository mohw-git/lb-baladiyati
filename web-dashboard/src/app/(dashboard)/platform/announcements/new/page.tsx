'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { platformAnnouncementsApi } from '@/lib/api/endpoints/platform-announcements';
import {
  PlatformAnnouncementForm,
  EMPTY_PLATFORM_ANNOUNCEMENT_FORM,
  toFormPayload,
} from '@/components/platform/platform-announcement-form';
import { useTranslate } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

export default function NewPlatformAnnouncementPage() {
  const t = useTranslate();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_PLATFORM_ANNOUNCEMENT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.summary.trim() || !form.content.trim()) {
        const e: Record<string, string> = {};
        if (!form.title.trim()) e.title = t('platform.announcements.validation.titleRequired');
        if (!form.summary.trim()) e.summary = t('platform.announcements.validation.summaryRequired');
        if (!form.content.trim()) e.content = t('platform.announcements.validation.contentRequired');
        setErrors(e);
        throw new Error('validation');
      }
      setErrors({});
      const created = await platformAnnouncementsApi.create(toFormPayload(form));
      if (pendingImage) {
        await platformAnnouncementsApi.uploadImage(created.id, pendingImage);
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(t('platform.announcements.toast.created'));
      router.push(`/platform/announcements/${created.id}`);
    },
    onError: (err: ApiError | Error) => {
      if (err.message !== 'validation') toast.error((err as ApiError).message || t('common.error'));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <Link href="/platform/announcements" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{t('platform.announcements.create')}</h1>
      </div>

      <PlatformAnnouncementForm
        form={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        errors={errors}
        onImageCropped={(file) => setPendingImage(file)}
        onImageRemove={() => setPendingImage(null)}
      />

      <div className="flex justify-end gap-2">
        <Link href="/platform/announcements" className="btn-gov-secondary">
          {t('common.cancel')}
        </Link>
        <button
          type="button"
          className="btn-gov-primary"
          disabled={createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? (
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
