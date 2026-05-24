'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { ApiError, departmentsApi, transfersApi } from '@/lib/api';
import type { TransferTargetType } from '@shared/types/transfer';
import { useTranslate, useLocale, pickName } from '@/lib/i18n';

interface TransferModalProps {
  targetType: TransferTargetType;
  targetId: string;
  targetTitle: string;
  fromDepartmentId: string;
  fromDepartmentName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransferModal({
  targetType,
  targetId,
  targetTitle,
  fromDepartmentId,
  fromDepartmentName,
  onClose,
  onSuccess,
}: TransferModalProps) {
  const t = useTranslate();
  const locale = useLocale();
  const [toDeptId, setToDeptId] = useState('');
  const [reason, setReason] = useState('');

  const { data: deps } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });
  const departments = (Array.isArray(deps) ? deps : (deps as any)?.data ?? [])
    .filter((d: any) => d.id !== fromDepartmentId);

  const create = useMutation({
    mutationFn: () =>
      transfersApi.create({
        targetType,
        targetId,
        toDepartmentId: toDeptId,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success(t('transfers.toast.sent'));
      onSuccess?.();
      onClose();
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const canSubmit = !!toDeptId && reason.trim().length >= 5 && !create.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !create.isPending && onClose()}
    >
      <div
        className="w-full max-w-lg rounded border border-gray-200 bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Send className="h-5 w-5 text-purple-600" />
          {t('transfers.modal.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-600">{t('transfers.modal.subtitle')}</p>

        <div className="mt-4 rounded bg-gray-50 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {targetType === 'COMPLAINT' ? t('common.reference') : t('common.title')}
          </div>
          <div className="text-sm font-medium text-gray-900">{targetTitle}</div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('transfers.field.targetDept')}
            </label>
            <select
              value={toDeptId}
              onChange={(e) => setToDeptId(e.target.value)}
              className="select-gov"
            >
              <option value="">{t('transfers.field.targetDept.placeholder')}</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {pickName(d, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('transfers.field.reason')} *
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={5}
              maxLength={1000}
              placeholder={t('transfers.field.reason.placeholder')}
              className="input-gov"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-gov-secondary">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded border border-purple-700 bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('transfers.btn.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
