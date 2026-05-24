'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { newsApi, ApiError } from '@/lib/api';
import { formatDate, getFullName, cn } from '@/lib/utils';
import { Plus, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { useTranslate, useLocale, isRtl } from '@/lib/i18n';

export default function NewsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['news', page, limit],
    queryFn: () => newsApi.list({ page, limit }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => newsApi.publish(id),
    onSuccess: () => {
      toast.success(t('news.toast.published'));
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => newsApi.unpublish(id),
    onSuccess: () => {
      toast.success(t('news.toast.unpublished'));
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => newsApi.remove(id),
    onSuccess: () => {
      toast.success(t('news.toast.deleted'));
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(t('news.confirm.delete').replace('{title}', title))) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('news.title')}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('news.subtitle')}</p>
        </div>
        <Link href="/news/new" className="btn-gov-primary">
          <Plus className="h-4 w-4" /> {t('news.new')}
        </Link>
      </div>

      <div className="gov-card overflow-hidden">
        <table className="gov-table w-full">
          <thead>
            <tr>
              <th>{t('news.col.title')}</th>
              <th>{t('news.col.author')}</th>
              <th>{t('news.col.status')}</th>
              <th>{t('news.col.date')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-gray-500">
                  {t('news.empty')}
                </td>
              </tr>
            ) : (
              data?.items.map((article) => (
                <tr key={article.id}>
                  <td className="font-medium text-gray-900">{article.title}</td>
                  <td className="text-gray-600">
                    {article.author ? getFullName(article.author) : '—'}
                  </td>
                  <td>
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        article.isPublished
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {article.isPublished ? t('news.status.published') : t('news.status.draft')}
                    </span>
                  </td>
                  <td className="text-gray-500">
                    {formatDate(article.publishedAt || article.createdAt)}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/news/${article.id}`}
                        className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
                      >
                        <Pencil className="h-4 w-4" /> {t('news.action.edit')}
                      </Link>
                      {article.isPublished ? (
                        <button
                          onClick={() => unpublishMutation.mutate(article.id)}
                          disabled={unpublishMutation.isPending}
                          className="flex items-center gap-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                          <EyeOff className="h-4 w-4" /> {t('news.action.unpublish')}
                        </button>
                      ) : (
                        <button
                          onClick={() => publishMutation.mutate(article.id)}
                          disabled={publishMutation.isPending}
                          className="flex items-center gap-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                        >
                          <Eye className="h-4 w-4" /> {t('news.action.publish')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(article.id, article.title)}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" /> {t('news.action.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              {t('news.pagination')
                .replace('{page}', String(data.meta.page))
                .replace('{total}', String(data.meta.totalPages))}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.meta.hasPrevPage}
                className="rounded border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                {rtl ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.meta.hasNextPage}
                className="rounded border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                {rtl ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
