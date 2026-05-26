'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { newsApi, ApiError } from '@/lib/api';
import {
  NEWS_CONTENT_MIN,
  NEWS_TITLE_MAX,
  NEWS_TITLE_MIN,
  trimNewsFields,
  validateNewsFields,
} from '@/lib/news-form';
import { ArrowLeft, Loader2, Save, Eye } from 'lucide-react';
import { useTranslate, useLocale, isRtl } from '@/lib/i18n';

export default function NewNewsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const [form, setForm] = useState({ title: '', content: '' });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [publishImmediately, setPublishImmediately] = useState(true);

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => {
      const article = await newsApi.create(payload, coverImage || undefined);
      if (publishImmediately && article?.id) {
        await newsApi.publish(article.id);
      }
      return article;
    },
    onSuccess: () => {
      toast.success(publishImmediately ? t('news.toast.published') : t('news.toast.created'));
      queryClient.invalidateQueries({ queryKey: ['news'] });
      router.push('/news');
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError
          ? err.getDisplayMessage(t('common.error'))
          : t('common.error');
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { title, content } = trimNewsFields(form.title, form.content);
    const validationMsg = validateNewsFields(title, content, t);
    if (validationMsg) {
      toast.error(validationMsg);
      return;
    }
    createMutation.mutate({ title, content });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <Link
          href="/news"
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.news')}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{t('news.detail.titleNew')}</h1>
      </div>

      <div className="gov-card p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('news.field.title')} *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              minLength={NEWS_TITLE_MIN}
              maxLength={NEWS_TITLE_MAX}
              className="input-gov"
            />
            <p className="mt-1 text-xs text-gray-500">{t('news.hint.titleMin')}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('news.field.content')} *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
              minLength={NEWS_CONTENT_MIN}
              rows={8}
              className="input-gov"
            />
            <p className="mt-1 text-xs text-gray-500">{t('news.hint.contentMin')}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('news.field.coverImage')}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
              className="input-gov"
            />
          </div>

          <div className="flex items-center gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <input
              type="checkbox"
              id="publishImmediately"
              checked={publishImmediately}
              onChange={(e) => setPublishImmediately(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="publishImmediately" className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-green-600" />
              <span className="font-medium text-gray-700">{t('news.field.publishNow')}</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Link href="/news" className="btn-gov-secondary">
              {t('common.cancel')}
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-gov-primary"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {publishImmediately ? t('news.btn.createPublish') : t('news.btn.saveDraft')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
