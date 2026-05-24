'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HandHelping, Loader2 } from 'lucide-react';
import { ApiError, departmentsApi, helpRequestsApi } from '@/lib/api';
import { useTranslate, useLocale, pickName } from '@/lib/i18n';

interface Props {
  complaintId: string;
  complaintTitle: string;
  fromDepartmentId: string;
  fromDepartmentName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestHelpModal({
  complaintId,
  complaintTitle,
  fromDepartmentId,
  fromDepartmentName,
  onClose,
  onSuccess,
}: Props) {
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
      helpRequestsApi.create(complaintId, {
        toDepartmentId: toDeptId,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success(t('helpRequests.toast.sent'));
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
          <HandHelping className="h-5 w-5 text-amber-600" />
          {t('helpRequests.modal.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-600">{t('helpRequests.modal.subtitle')}</p>

        <div className="mt-4 rounded bg-amber-50 p-3 text-amber-900">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
            {t('common.complaint' as any) || t('common.reference')}
          </div>
          <div className="text-sm font-medium">{complaintTitle}</div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('helpRequests.field.targetDept')}
            </label>
            <select
              value={toDeptId}
              onChange={(e) => setToDeptId(e.target.value)}
              className="select-gov"
            >
              <option value="">{t('helpRequests.field.targetDept.placeholder')}</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {pickName(d, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('helpRequests.field.reason')} *
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={5}
              maxLength={1000}
              placeholder={t('helpRequests.field.reason.placeholder')}
              className="input-gov"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="btn-gov-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('helpRequests.btn.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
