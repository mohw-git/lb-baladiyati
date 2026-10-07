'use client';

import { ImageUploadCropper } from '@/components/ui/image-upload-cropper';
import { useTranslate } from '@/lib/i18n';

export type PlatformAnnouncementFormState = {
  title: string;
  titleAr: string;
  titleFr: string;
  summary: string;
  summaryAr: string;
  summaryFr: string;
  content: string;
  contentAr: string;
  contentFr: string;
  imageUrl: string;
  isPinned: boolean;
  priority: number;
  publishAt: string;
  expiresAt: string;
};

type Props = {
  form: PlatformAnnouncementFormState;
  onChange: (patch: Partial<PlatformAnnouncementFormState>) => void;
  onImageCropped: (file: File) => void;
  onImageRemove?: () => void;
  errors?: Record<string, string>;
};

const CROP_ASPECT = 16 / 9;

export function PlatformAnnouncementForm({
  form,
  onChange,
  onImageCropped,
  onImageRemove,
  errors,
}: Props) {
  const t = useTranslate();

  const field = (
    label: string,
    key: keyof PlatformAnnouncementFormState,
    multiline = false,
  ) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {multiline ? (
        <textarea
          className="input-gov min-h-[80px]"
          value={form[key] as string}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      ) : (
        <input
          className="input-gov"
          value={form[key] as string}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      )}
      {errors?.[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <ImageUploadCropper
        label={t('platform.announcements.image')}
        hint={t('platform.announcements.imageHint')}
        value={form.imageUrl}
        onCropped={onImageCropped}
        onRemove={onImageRemove}
        aspect={CROP_ASPECT}
        circular={false}
        previewSize={140}
      />

      <div className="gov-card p-4">
        <p className="gov-section-header mb-3 text-sm font-semibold">English</p>
        <div className="grid gap-3">
          {field(t('platform.announcements.field.title'), 'title')}
          {field(t('platform.announcements.field.summary'), 'summary', true)}
          {field(t('platform.announcements.field.content'), 'content', true)}
        </div>
      </div>

      <div className="gov-card p-4">
        <p className="gov-section-header mb-3 text-sm font-semibold">العربية</p>
        <div className="grid gap-3" dir="rtl">
          {field(t('platform.announcements.field.title'), 'titleAr')}
          {field(t('platform.announcements.field.summary'), 'summaryAr', true)}
          {field(t('platform.announcements.field.content'), 'contentAr', true)}
        </div>
      </div>

      <div className="gov-card p-4">
        <p className="gov-section-header mb-3 text-sm font-semibold">Français</p>
        <div className="grid gap-3">
          {field(t('platform.announcements.field.title'), 'titleFr')}
          {field(t('platform.announcements.field.summary'), 'summaryFr', true)}
          {field(t('platform.announcements.field.content'), 'contentFr', true)}
        </div>
      </div>

      <div className="gov-card grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => onChange({ isPinned: e.target.checked })}
            />
            {t('platform.announcements.field.pinned')}
          </label>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('platform.announcements.field.priority')}
          </label>
          <input
            type="number"
            className="input-gov"
            value={form.priority}
            onChange={(e) => onChange({ priority: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('platform.announcements.field.publishAt')}
          </label>
          <input
            type="datetime-local"
            className="input-gov"
            value={form.publishAt}
            onChange={(e) => onChange({ publishAt: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('platform.announcements.field.expiresAt')}
          </label>
          <input
            type="datetime-local"
            className="input-gov"
            value={form.expiresAt}
            onChange={(e) => onChange({ expiresAt: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export const EMPTY_PLATFORM_ANNOUNCEMENT_FORM: PlatformAnnouncementFormState = {
  title: '',
  titleAr: '',
  titleFr: '',
  summary: '',
  summaryAr: '',
  summaryFr: '',
  content: '',
  contentAr: '',
  contentFr: '',
  imageUrl: '',
  isPinned: false,
  priority: 0,
  publishAt: '',
  expiresAt: '',
};

export function toFormPayload(form: PlatformAnnouncementFormState) {
  return {
    title: form.title.trim(),
    titleAr: form.titleAr.trim() || undefined,
    titleFr: form.titleFr.trim() || undefined,
    summary: form.summary.trim(),
    summaryAr: form.summaryAr.trim() || undefined,
    summaryFr: form.summaryFr.trim() || undefined,
    content: form.content.trim(),
    contentAr: form.contentAr.trim() || undefined,
    contentFr: form.contentFr.trim() || undefined,
    isPinned: form.isPinned,
    priority: form.priority,
    publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : undefined,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
  };
}

export function announcementToForm(a: {
  title: string;
  titleAr?: string | null;
  titleFr?: string | null;
  summary: string;
  summaryAr?: string | null;
  summaryFr?: string | null;
  content: string;
  contentAr?: string | null;
  contentFr?: string | null;
  imageUrl?: string | null;
  isPinned: boolean;
  priority: number;
  publishAt?: string | null;
  expiresAt?: string | null;
}): PlatformAnnouncementFormState {
  const toLocal = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    title: a.title || '',
    titleAr: a.titleAr || '',
    titleFr: a.titleFr || '',
    summary: a.summary || '',
    summaryAr: a.summaryAr || '',
    summaryFr: a.summaryFr || '',
    content: a.content || '',
    contentAr: a.contentAr || '',
    contentFr: a.contentFr || '',
    imageUrl: a.imageUrl || '',
    isPinned: a.isPinned,
    priority: a.priority,
    publishAt: toLocal(a.publishAt),
    expiresAt: toLocal(a.expiresAt),
  };
}
