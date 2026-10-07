'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import { helpRequestsApi, ApiError } from '@/lib/api';
import { HelpRequestWorkspace } from '@/components/help-requests/help-request-workspace';
import { useTranslate, isRtl, useLocale } from '@/lib/i18n';

export default function HelpRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['help-request', id],
    queryFn: () => helpRequestsApi.getById(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError) {
    const status = (error as ApiError)?.status;
    const message =
      status === 403
        ? t('helpRequests.error.noAccess')
        : status === 404
          ? t('helpRequests.error.notFound')
          : (error as Error)?.message ?? t('common.error');
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-600">{message}</p>
        <Link href="/help-requests" className="mt-4 inline-flex items-center gap-1 text-sm text-brand-600">
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
          {t('helpRequests.title')}
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">
        {t('helpRequests.error.notFound')}
      </div>
    );
  }

  return <HelpRequestWorkspace detail={data} />;
}
