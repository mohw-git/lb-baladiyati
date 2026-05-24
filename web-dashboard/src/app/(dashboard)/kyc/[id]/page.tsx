'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kycApi, type KycSubmission } from '@/lib/api/endpoints/kyc';
import { getFileUrl } from '@/lib/api/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, ShieldCheck, CheckCircle, XCircle, Clock, User,
  Mail, Phone, FileImage, Calendar, MessageSquare, AlertTriangle,
} from 'lucide-react';
import { useTranslate, useLocale, isRtl, type MessageKey, kycStatusKey } from '@/lib/i18n';

const ACTION_ICONS: Record<string, { icon: React.ReactNode; color: string; key: MessageKey }> = {
  SUBMITTED: { icon: <Clock className="h-4 w-4" />, color: 'text-blue-600 bg-blue-100', key: 'kyc.status.PENDING' },
  APPROVED: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600 bg-green-100', key: 'kyc.status.APPROVED' },
  REJECTED: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-600 bg-red-100', key: 'kyc.status.REJECTED' },
};

export default function KycDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const id = params.id as string;

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data: submission, isLoading, isError } = useQuery({
    queryKey: ['kyc-detail', id],
    queryFn: () => kycApi.getById(id),
    enabled: !!id,
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { action: 'APPROVE' | 'REJECT'; reason?: string }) =>
      kycApi.review(id, data),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'APPROVE' ? t('kyc.toast.approved') : t('kyc.toast.rejected'));
      queryClient.invalidateQueries({ queryKey: ['kyc-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['kyc-submissions'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || t('common.error'));
    },
  });

  const handleApprove = () => {
    reviewMutation.mutate({ action: 'APPROVE' });
  };

  const handleReject = () => {
    if (rejectReason.length < 10) {
      toast.error(t('kyc.toast.invalidReason'));
      return;
    }
    reviewMutation.mutate({ action: 'REJECT', reason: rejectReason });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (isError || !submission) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {t('kyc.notFound')}
      </div>
    );
  }

  const isPending = submission.status === 'PENDING';

  // Build secure image URLs
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
  const getSecureUrl = (attachmentId: string) => {
    // We need to fetch with auth, so we'll use an img tag with fetch approach
    return `${API_URL}${kycApi.getAttachmentUrl(submission.id, attachmentId)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <button
          onClick={() => router.push('/kyc')}
          className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{t('kyc.detail.title')}</h1>
          <p className="text-sm text-gray-500">
            {submission.user.firstName} {submission.user.lastName}
          </p>
        </div>
        <StatusBadge status={submission.status} t={t} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="gov-card p-4">
          <div className="gov-section-header">
            <User className="h-4 w-4" /> {t('kyc.detail.section.citizen')}
          </div>
          <div className="mt-3 space-y-2">
            <InfoRow icon={<User className="h-4 w-4" />} label={t('users.field.firstName')} value={`${submission.user.firstName} ${submission.user.lastName}`} />
            <InfoRow icon={<Mail className="h-4 w-4" />} label={t('common.email')} value={submission.user.email} />
            {(submission.user as any).phone && (
              <InfoRow icon={<Phone className="h-4 w-4" />} label={t('common.phone')} value={(submission.user as any).phone} />
            )}
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label={t('common.submittedAt')}
              value={format(new Date(submission.submittedAt), 'MMM d, yyyy HH:mm')}
            />
            {submission.reviewedAt && (
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label={t('common.updatedAt')}
                value={format(new Date(submission.reviewedAt), 'MMM d, yyyy HH:mm')}
              />
            )}
          </div>
        </div>

        <div className="gov-card lg:col-span-2 p-4">
          <div className="gov-section-header">
            <FileImage className="h-4 w-4" /> {t('kyc.detail.section.documents')}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {submission.attachments?.map((att) => (
              <div key={att.id} className="overflow-hidden rounded border border-gray-200">
                <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {att.docType === 'ID_FRONT' ? t('kyc.detail.idFront') :
                   att.docType === 'ID_BACK' ? t('kyc.detail.idBack') :
                   att.docType === 'SELFIE' ? t('kyc.detail.selfie') :
                   String(att.docType).replace('_', ' ')}
                </div>
                <SecureImage url={getSecureUrl(att.id)} alt={att.docType} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {isPending && (
        <div className="gov-card p-4">
          <div className="gov-section-header">{t('kyc.detail.section.review')}</div>
          {showRejectForm ? (
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('kyc.btn.reject')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="input-gov"
                  placeholder={t('kyc.detail.rejection.placeholder')}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowRejectForm(false)} className="btn-gov-secondary">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleReject}
                  disabled={reviewMutation.isPending || rejectReason.length < 10}
                  className="flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {reviewMutation.isPending ? t('common.loading') : t('kyc.btn.reject')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleApprove}
                disabled={reviewMutation.isPending}
                className="flex items-center gap-2 rounded border border-green-600 bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {reviewMutation.isPending ? t('common.loading') : t('kyc.btn.approve')}
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <XCircle className="h-4 w-4" />
                {t('kyc.btn.reject')}
              </button>
            </div>
          )}
        </div>
      )}

      {submission.rejectionReason && (
        <div className="rounded border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-800">{t('kyc.btn.reject')}</h3>
              <p className="mt-1 text-sm text-red-700">{submission.rejectionReason}</p>
            </div>
          </div>
        </div>
      )}

      {submission.reviewLogs && submission.reviewLogs.length > 0 && (
        <div className="gov-card p-4">
          <div className="gov-section-header">
            <MessageSquare className="h-4 w-4" /> {t('audit.title')}
          </div>
          <div className="mt-3 space-y-2">
            {submission.reviewLogs.map((log) => {
              const cfg = ACTION_ICONS[log.action] || ACTION_ICONS.SUBMITTED;
              return (
                <div key={log.id} className="flex items-start gap-3 rounded bg-gray-50 p-3">
                  <div className={`rounded-full p-1.5 ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {t(cfg.key)}
                    </p>
                    {log.reason && (
                      <p className="mt-1 text-xs text-gray-500">{log.reason}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {log.performedBy.firstName} {log.performedBy.lastName} &middot;{' '}
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (k: MessageKey) => string }) {
  const className: Record<string, string> = {
    PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
    VERIFIED: 'bg-green-50 text-green-700 border-green-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
  };
  const labelKey: Record<string, MessageKey> = {
    PENDING: 'kyc.status.PENDING',
    VERIFIED: 'kyc.status.APPROVED',
    REJECTED: 'kyc.status.REJECTED',
  };
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${className[status] || className.PENDING}`}>
      {t(labelKey[status] || labelKey.PENDING)}
    </span>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-400">{icon}</span>
      <span className="font-medium text-gray-500">{label}:</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

/**
 * Loads KYC images via authenticated fetch and displays them.
 * KYC files are NOT publicly served; they require auth headers.
 */
function SecureImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Load via authenticated fetch
  useState(() => {
    const token = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('baladi-auth') || '{}')?.state?.accessToken
      : null;

    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.blob();
      })
      .then((blob) => {
        setSrc(URL.createObjectURL(blob));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  });

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center bg-gray-100">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-48 flex-col items-center justify-center bg-gray-100 text-gray-400">
        <FileImage className="h-8 w-8" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-48 w-full cursor-pointer object-cover transition-transform hover:scale-105"
      onClick={() => src && window.open(src, '_blank')}
    />
  );
}
