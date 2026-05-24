'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Inbox,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { ApiError, departmentsApi, transfersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/hooks';
import { PERMISSIONS } from '@shared/constants/permissions';
import type { TransferRequest, TransferStatus } from '@shared/types/transfer';
import { formatDate } from '@/lib/utils';
import { useTranslate, type MessageKey } from '@/lib/i18n';

const STATUS_BADGE: Record<TransferStatus, { color: string; labelKey: MessageKey }> = {
  PENDING: { color: 'bg-amber-100 text-amber-800', labelKey: 'transfers.status.PENDING' },
  ACCEPTED: { color: 'bg-green-100 text-green-800', labelKey: 'transfers.status.ACCEPTED' },
  REJECTED: { color: 'bg-red-100 text-red-800', labelKey: 'transfers.status.REJECTED' },
  CANCELLED: { color: 'bg-gray-100 text-gray-700', labelKey: 'transfers.status.CANCELED' },
  AUTO_CANCELLED: { color: 'bg-gray-100 text-gray-700', labelKey: 'transfers.status.WITHDRAWN' },
};

export default function TransfersInboxPage() {
  const { user } = useAuth();
  const t = useTranslate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'inbox' | 'outgoing'>('inbox');

  const canRespond = user?.permissions?.includes(PERMISSIONS.TRANSFER_RESPOND);
  const canRequest = user?.permissions?.includes(PERMISSIONS.TRANSFER_REQUEST);

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', tab],
    queryFn: () =>
      transfersApi.list({
        inbox: tab === 'inbox' || undefined,
        outgoing: tab === 'outgoing' || undefined,
        limit: 100,
      }),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const transfers: TransferRequest[] = data?.items ?? [];
  const pending = transfers.filter((t) => t.status === 'PENDING');
  const past = transfers.filter((t) => t.status !== 'PENDING');

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Inbox className="h-5 w-5" /> {t('transfers.title')}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('transfers.subtitle')}</p>
      </div>

      <div className="flex gap-2">
        {canRespond && (
          <button
            onClick={() => setTab('inbox')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${
              tab === 'inbox'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            <Inbox className="h-4 w-4" /> {t('transfers.tab.inbox')}
            {pending.length > 0 && tab === 'inbox' && (
              <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-brand-700">
                {pending.length}
              </span>
            )}
          </button>
        )}
        {canRequest && (
          <button
            onClick={() => setTab('outgoing')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${
              tab === 'outgoing'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            <Send className="h-4 w-4" /> {t('transfers.tab.outbox')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
          {tab === 'inbox' ? t('transfers.empty.inbox') : t('transfers.empty.outbox')}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                <Clock className="h-4 w-4" /> Pending — needs decision
              </h2>
              <div className="space-y-3">
                {pending.map((t) => (
                  <TransferCard
                    key={t.id}
                    transfer={t}
                    canAct={tab === 'inbox' && !!canRespond}
                    canCancel={tab === 'outgoing' && t.requestedById === user?.id}
                    onChanged={() => qc.invalidateQueries({ queryKey: ['transfers'] })}
                  />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Past
              </h2>
              <div className="space-y-3">
                {past.map((t) => (
                  <TransferCard
                    key={t.id}
                    transfer={t}
                    canAct={false}
                    canCancel={false}
                    onChanged={() => undefined}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TransferCard({
  transfer,
  canAct,
  canCancel,
  onChanged,
}: {
  transfer: TransferRequest;
  canAct: boolean;
  canCancel: boolean;
  onChanged: () => void;
}) {
  const [showAccept, setShowAccept] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [pickedAssignee, setPickedAssignee] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const t = useTranslate();

  const meta = STATUS_BADGE[transfer.status];

  // Use the per-department `members` endpoint instead of the global `/users`
  // endpoint. The previous /users call required `user.view_all` which HOD
  // doesn't have, so the dropdown was empty even when the dept had staff.
  // departmentsApi.listMembers is dept-scoped and authorised for any
  // authenticated user in the same municipality.
  const { data: membersData } = useQuery({
    queryKey: ['department', transfer.toDepartmentId, 'members'],
    queryFn: () => departmentsApi.listMembers(transfer.toDepartmentId),
    enabled: showAccept && !!transfer.toDepartmentId,
  });
  const candidates = (membersData?.members ?? []).filter(
    (m: any) => m.isActive,
  );

  const accept = useMutation({
    mutationFn: () =>
      transfersApi.accept(transfer.id, { newAssigneeId: pickedAssignee }),
    onSuccess: () => {
      toast.success(t('transfers.toast.accepted'));
      setShowAccept(false);
      onChanged();
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const reject = useMutation({
    mutationFn: () =>
      transfersApi.reject(transfer.id, { reason: rejectReason.trim() }),
    onSuccess: () => {
      toast.success(t('transfers.toast.rejected'));
      setShowReject(false);
      onChanged();
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const cancel = useMutation({
    mutationFn: () => transfersApi.cancel(transfer.id),
    onSuccess: () => {
      toast.success(t('transfers.toast.withdrawn'));
      onChanged();
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`}
            >
              {t(meta.labelKey)}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              {transfer.targetType}
            </span>
            <Building2 className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-medium text-gray-900">
              {transfer.fromDepartment?.name}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-medium text-gray-900">
              {transfer.toDepartment?.name}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-700">{transfer.reason}</p>
          <p className="mt-1 text-xs text-gray-500">
            Requested by {transfer.requestedBy?.firstName}{' '}
            {transfer.requestedBy?.lastName} • {formatDate(transfer.createdAt)}
          </p>
          {transfer.responseReason && (
            <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
              <span className="font-medium">
                {transfer.status === 'REJECTED' ? 'Rejection reason' : 'Note'}:
              </span>{' '}
              {transfer.responseReason}
            </div>
          )}
          {transfer.newAssignee && (
            <p className="mt-1 text-xs text-green-700">
              Assigned to {transfer.newAssignee.firstName}{' '}
              {transfer.newAssignee.lastName}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <a
            href={
              transfer.targetType === 'COMPLAINT'
                ? `/complaints/${transfer.targetId}`
                : `/tasks/${transfer.targetId}`
            }
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            View {transfer.targetType.toLowerCase()} →
          </a>
          {canAct && (
            <>
              <button
                onClick={() => setShowAccept(true)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </button>
            </>
          )}
          {canCancel && (
            <button
              onClick={() => {
                if (confirm(t('transfers.confirm.withdraw'))) cancel.mutate();
              }}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Accept modal */}
      {showAccept && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !accept.isPending && setShowAccept(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-green-700">
              Accept transfer
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Pick a member of <strong>{transfer.toDepartment?.name}</strong>{' '}
              to own this work. The {transfer.targetType.toLowerCase()} will
              move to your department immediately.
            </p>
            <select
              value={pickedAssignee}
              onChange={(e) => setPickedAssignee(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">— Select staff —</option>
              {candidates.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                No staff in your department. Add a Worker / Supervisor first.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowAccept(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => accept.mutate()}
                disabled={!pickedAssignee || accept.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Accept &amp; assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !reject.isPending && setShowReject(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-red-700">
              Reject transfer
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              The original requester will be notified with this reason.
            </p>
            <textarea
              rows={4}
              minLength={5}
              maxLength={1000}
              placeholder="Why is this not appropriate for your department?"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowReject(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => reject.mutate()}
                disabled={rejectReason.trim().length < 5 || reject.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {reject.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
