'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { kycApi } from '@/lib/api/endpoints/kyc';
import { useAuthStore } from '@/lib/auth';
import { isCitizenAccount } from '@/lib/auth/user';
import { useTranslate, type MessageKey } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import { compressImageForKyc, validateKycImageFile } from '@/lib/utils/image-compress';

type DocKey = 'idFront' | 'idBack' | 'selfie';

type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * Citizen identity verification (KYC) submission card.
 * Uses POST /kyc/submit and GET /kyc/me — same APIs as the mobile app.
 */
export function CitizenKycCard({ className = '' }: { className?: string }) {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});

  const { data: kycStatus, isLoading } = useQuery({
    queryKey: ['kyc', 'me'],
    queryFn: () => kycApi.getMyStatus(),
    enabled: isCitizenAccount(user),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!files.idFront || !files.idBack || !files.selfie) {
        throw new Error(t('profile.kyc.error.missingFiles'));
      }
      const [idFront, idBack, selfie] = await Promise.all([
        compressImageForKyc(files.idFront),
        compressImageForKyc(files.idBack),
        compressImageForKyc(files.selfie),
      ]);
      return kycApi.submit({ idFront, idBack, selfie });
    },
    onSuccess: async () => {
      toast.success(t('profile.kyc.toast.submitted'));
      setFiles({});
      queryClient.invalidateQueries({ queryKey: ['kyc', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      try {
        const { authApi } = await import('@/lib/api/endpoints/auth');
        const fresh = await authApi.getProfile();
        setUser(fresh);
      } catch {
        /* profile refresh is best-effort */
      }
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('profile.kyc.error.submitFailed');
      toast.error(msg);
    },
  });

  if (!isCitizenAccount(user)) return null;

  const status: VerificationStatus =
    (kycStatus?.verificationStatus as VerificationStatus) ||
    (user?.verificationStatus as VerificationStatus) ||
    'UNVERIFIED';

  const isPending = status === 'PENDING' || kycStatus?.hasActiveSubmission;
  const isVerified = status === 'VERIFIED';
  const isRejected = status === 'REJECTED';
  const canSubmit = !isVerified && !isPending && (status === 'UNVERIFIED' || isRejected);
  const allFilesPicked = !!(files.idFront && files.idBack && files.selfie);

  const statusConfig = getStatusConfig(status, t);

  if (isLoading) {
    return (
      <div className={`gov-card flex justify-center p-8 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`gov-card overflow-hidden ${className}`}>
      <div className="gov-section-header flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          {t('profile.kyc.title')}
        </span>
        <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${statusConfig.cls}`}>
          {statusConfig.label}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-sm text-gray-600">{statusConfig.sub}</p>

        {isRejected && kycStatus?.rejectionReason && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-semibold">{t('profile.kyc.rejectionReason')}</p>
              <p className="mt-1">{kycStatus.rejectionReason}</p>
            </div>
          </div>
        )}

        {isPending && (
          <p className="rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2 text-xs text-orange-900">
            {t('profile.kyc.pendingHint')}
          </p>
        )}

        {canSubmit && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KycFilePicker
                label={t('profile.kyc.idFront')}
                file={files.idFront}
                onChange={(f) => setFiles((s) => ({ ...s, idFront: f }))}
                invalidTypeMessage={t('profile.kyc.error.invalidType')}
                tooLargeMessage={t('profile.kyc.error.tooLarge')}
              />
              <KycFilePicker
                label={t('profile.kyc.idBack')}
                file={files.idBack}
                onChange={(f) => setFiles((s) => ({ ...s, idBack: f }))}
                invalidTypeMessage={t('profile.kyc.error.invalidType')}
                tooLargeMessage={t('profile.kyc.error.tooLarge')}
              />
              <KycFilePicker
                label={t('profile.kyc.selfie')}
                file={files.selfie}
                onChange={(f) => setFiles((s) => ({ ...s, selfie: f }))}
                invalidTypeMessage={t('profile.kyc.error.invalidType')}
                tooLargeMessage={t('profile.kyc.error.tooLarge')}
              />
            </div>
            <p className="text-xs text-gray-500">{t('profile.kyc.fileHint')}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={!allFilesPicked || submitMutation.isPending}
                className="btn-gov-primary flex items-center gap-1.5"
              >
                {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('profile.kyc.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getStatusConfig(status: VerificationStatus, t: (key: MessageKey) => string) {
  const map: Record<VerificationStatus, { label: string; cls: string; sub: string }> = {
    VERIFIED: {
      label: t('profile.kyc.status.verified'),
      cls: 'bg-green-50 border-green-200 text-green-800',
      sub: t('profile.kyc.approved'),
    },
    PENDING: {
      label: t('profile.kyc.status.pending'),
      cls: 'bg-orange-50 border-orange-200 text-orange-800',
      sub: t('profile.kyc.pending'),
    },
    REJECTED: {
      label: t('profile.kyc.status.rejected'),
      cls: 'bg-red-50 border-red-200 text-red-800',
      sub: t('profile.kyc.rejected'),
    },
    UNVERIFIED: {
      label: t('profile.kyc.status.notSubmitted'),
      cls: 'bg-gray-50 border-gray-200 text-gray-700',
      sub: t('profile.kyc.intro'),
    },
  };
  return map[status] ?? map.UNVERIFIED;
}

function KycFilePicker({
  label,
  file,
  onChange,
  invalidTypeMessage,
  tooLargeMessage,
}: {
  label: string;
  file?: File;
  onChange: (f: File | undefined) => void;
  invalidTypeMessage: string;
  tooLargeMessage: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="block cursor-pointer">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      <div className="flex h-36 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/30">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center px-2 text-center text-gray-400">
            <Camera className="h-6 w-6" />
            <span className="mt-1 text-xs">{label}</span>
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const err = validateKycImageFile(f);
          if (err === 'INVALID_TYPE') {
            toast.error(invalidTypeMessage);
            return;
          }
          if (err === 'TOO_LARGE') {
            toast.error(tooLargeMessage);
            return;
          }
          onChange(f);
        }}
      />
    </label>
  );
}
