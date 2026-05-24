'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { newsApi, getFileUrl, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ArrowLeft, Loader2, Save, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useTranslate, useLocale, isRtl } from '@/lib/i18n';

export default function EditNewsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const [form, setForm] = useState({ title: '', content: '' });
  const [coverImage, setCoverImage] = useState<File | null>(null);

  const { data: article, isLoading } = useQuery({
    queryKey: ['news', id],
    queryFn: () => newsApi.getById(id),
  });

  useEffect(() => {
    if (article) {
      setForm({ title: article.title, content: article.content });
    }
  }, [article]);

  const updateMutation = useMutation({
    mutationFn: () =>
      newsApi.update(
        id,
        { title: form.title, content: form.content },
        coverImage || undefined
      ),
    onSuccess: () => {
      toast.success(t('news.toast.updated'));
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news', id] });
      setCoverImage(null);
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => newsApi.publish(id),
    onSuccess: () => {
      toast.success(t('news.toast.published'));
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => newsApi.unpublish(id),
    onSuccess: () => {
      toast.success(t('news.toast.unpublished'));
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => newsApi.remove(id),
    onSuccess: () => {
      toast.success(t('news.toast.deleted'));
      router.push('/news');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const handleDelete = () => {
    if (confirm(t('news.confirm.delete').replace('{title}', article?.title || ''))) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!article) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">
        {t('news.empty')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <Link
          href="/news"
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.news')}
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t('news.detail.title')}</h1>
          <span
            className={cn(
              'rounded px-2 py-0.5 text-xs font-medium',
              article.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            )}
          >
            {article.isPublished ? t('news.status.published') : t('news.status.draft')}
          </span>
        </div>
      </div>

      <div className="gov-card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('news.field.title')} *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="input-gov"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('news.field.content')} *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
              rows={8}
              className="input-gov"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('news.field.coverImage')}</label>
            {article.coverImageUrl && !coverImage && (
              <div className="mb-2">
                <img
                  src={getFileUrl(article.coverImageUrl)}
                  alt={article.title}
                  className="h-24 rounded object-cover"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
              className="input-gov"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {article.isPublished ? (
              <button
                type="button"
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
                className="btn-gov-secondary"
              >
                <EyeOff className="h-4 w-4" /> {t('news.action.unpublish')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="flex items-center gap-1.5 rounded border border-green-700 bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" /> {t('news.action.publish')}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> {t('news.action.delete')}
            </button>
            <Link href="/news" className="btn-gov-secondary">
              {t('common.cancel')}
            </Link>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-gov-primary"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
