'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, CheckCircle2, HandHelping, Loader2, MapPin,
  Paperclip, ShieldCheck, Trash2, UploadCloud, XCircle,
} from 'lucide-react';
import { ApiError, helpRequestsApi, getFileUrl, departmentsApi } from '@/lib/api';
import type { HelpRequestDetail, HelpRequestStatus } from '@shared/types/help-request';
import { useAuthStore } from '@/lib/auth';
import { formatDate, getFullName } from '@/lib/utils';
import { useTranslate, useLocale, isRtl, pickName, type MessageKey } from '@/lib/i18n';

const STATUS_STYLE: Record<HelpRequestStatus, { labelKey: MessageKey; cls: string }> = {
  PENDING_SOURCE_APPROVAL: { labelKey: 'helpRequests.status.PENDING_SOURCE_APPROVAL', cls: 'bg-orange-100 text-orange-800' },
  SOURCE_REJECTED:         { labelKey: 'helpRequests.status.SOURCE_REJECTED',         cls: 'bg-rose-100 text-rose-800' },
  PENDING:                 { labelKey: 'helpRequests.status.PENDING_RECEIVER',        cls: 'bg-yellow-100 text-yellow-800' },
  ACCEPTED:                { labelKey: 'helpRequests.status.ACCEPTED',                cls: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS:             { labelKey: 'helpRequests.status.IN_PROGRESS',             cls: 'bg-blue-100 text-blue-800' },
  SUBMITTED:               { labelKey: 'helpRequests.status.SUBMITTED',               cls: 'bg-purple-100 text-purple-800' },
  COMPLETED:               { labelKey: 'helpRequests.status.APPROVED',                cls: 'bg-green-100 text-green-800' },
  DECLINED:                { labelKey: 'helpRequests.status.DECLINED',                cls: 'bg-rose-100 text-rose-800' },
  REJECTED:                { labelKey: 'helpRequests.status.REJECTED_RESULT',         cls: 'bg-rose-100 text-rose-800' },
  CANCELLED:               { labelKey: 'helpRequests.status.CANCELED',                cls: 'bg-gray-100 text-gray-700' },
};

const EVENT_LABELS: Record<string, MessageKey> = {
  HELP_REQUESTED: 'helpRequests.event.requested',
  HELP_SOURCE_APPROVED: 'helpRequests.event.sourceApproved',
  HELP_SOURCE_REJECTED: 'helpRequests.event.sourceRejected',
  HELP_ACCEPTED: 'helpRequests.event.accepted',
  HELP_DECLINED: 'helpRequests.event.declined',
  HELP_ASSIGNED: 'helpRequests.event.assigned',
  HELP_SUBMITTED: 'helpRequests.event.submitted',
  HELP_APPROVED: 'helpRequests.event.approved',
  HELP_REJECTED: 'helpRequests.event.rejected',
  HELP_CANCELLED: 'helpRequests.event.cancelled',
};

interface Props {
  detail: HelpRequestDetail;
}

export function HelpRequestWorkspace({ detail }: Props) {
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user) as any;
  const hr = detail;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['help-request', hr.id] });
    queryClient.invalidateQueries({ queryKey: ['help-requests'] });
    queryClient.invalidateQueries({ queryKey: ['help-requests', 'complaint', hr.complaintId] });
    queryClient.invalidateQueries({ queryKey: ['complaint', hr.complaintId] });
  };

  const style = STATUS_STYLE[hr.status];
  const ctx = detail.complaintContext;
  const isTerminal = ['COMPLETED', 'DECLINED', 'REJECTED', 'CANCELLED', 'SOURCE_REJECTED'].includes(hr.status);

  const isHelperHod = me?.id && hr.toDepartment?.headUserId === me.id;
  const isOriginalHod = me?.id && hr.fromDepartment?.headUserId === me.id;
  const isAssignedHelper = me?.id && hr.helperAssigneeId === me.id;
  const isRequester = me?.id === hr.requestedById;
  const isAdmin = !!me?.isSuperAdmin || (me?.permissions ?? []).includes('complaint.view_all');
  const hasSourceOversight =
    isAdmin ||
    isOriginalHod ||
    (me?.permissions ?? []).includes('complaint.view_department');

  const [showAssign, setShowAssign] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showRejectSource, setShowRejectSource] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const approveSource = useMutation({
    mutationFn: () => helpRequestsApi.approveSource(hr.id, {}),
    onSuccess: () => { toast.success(t('helpRequests.toast.sourceApproved')); invalidate(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const accept = useMutation({
    mutationFn: () => helpRequestsApi.accept(hr.id, {}),
    onSuccess: () => { toast.success(t('helpRequests.toast.accepted')); invalidate(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: () => helpRequestsApi.cancel(hr.id),
    onSuccess: () => { toast.success(t('helpRequests.toast.cancelled')); invalidate(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: () => helpRequestsApi.approve(hr.id, {}),
    onSuccess: () => { toast.success(t('helpRequests.toast.approved')); invalidate(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const canApproveSource = hr.status === 'PENDING_SOURCE_APPROVAL' && hasSourceOversight;
  const canRejectSource = hr.status === 'PENDING_SOURCE_APPROVAL' && hasSourceOversight;
  const canAccept = hr.status === 'PENDING' && (isHelperHod || isAdmin);
  const canDecline = hr.status === 'PENDING' && (isHelperHod || isAdmin);
  const canCancel =
    ['PENDING_SOURCE_APPROVAL', 'PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(hr.status) &&
    (isRequester || isOriginalHod || isAdmin);
  const canAssign =
    ['ACCEPTED', 'IN_PROGRESS'].includes(hr.status) && (isHelperHod || isAdmin);
  const canSubmit =
    ['ACCEPTED', 'IN_PROGRESS'].includes(hr.status) &&
    (isAssignedHelper || isHelperHod || isAdmin);
  const canApproveResult = hr.status === 'SUBMITTED' && (isOriginalHod || isAdmin || hasSourceOversight);
  const canRejectResult = hr.status === 'SUBMITTED' && (isOriginalHod || isAdmin || hasSourceOversight);

  const hasComplaintAccess =
    isAdmin ||
    isRequester ||
    (me?.department?.id && me.department.id === ctx?.owningDepartment?.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/help-requests"
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
          {t('helpRequests.title')}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <HandHelping className="h-5 w-5 text-amber-600" />
              {t('helpRequests.detail.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {t('helpRequests.detail.ownershipNote').replace(
                '{department}',
                hr.fromDepartment?.name ?? '—',
              )}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${style.cls}`}>
            {t(style.labelKey)}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 text-sm text-amber-900">
        <div className="font-medium">
          {hr.fromDepartment?.name} <ArrowRight className="inline h-4 w-4" /> {hr.toDepartment?.name}
        </div>
        <p className="mt-1 text-amber-800">
          {t('helpRequests.panel.requester')}: {hr.requestedBy ? getFullName(hr.requestedBy) : '—'}
          {hr.helperAssignee && (
            <> · {t('helpRequests.panel.assignee')}: {getFullName(hr.helperAssignee)}</>
          )}
        </p>
      </div>

      <div className="gov-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">{t('helpRequests.panel.reason')}</h2>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{hr.reason}</p>
      </div>

      {ctx && (
        <div className="gov-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">{t('helpRequests.detail.complaintContext')}</h2>
          <div className="flex flex-wrap gap-2 text-sm text-gray-500">
            <span className="font-mono">{ctx.referenceCode}</span>
            {ctx.category && <span>· {pickName(ctx.category as any, locale)}</span>}
            <span>· {formatDate(ctx.createdAt, 'MMM d, yyyy')}</span>
          </div>
          <h3 className="text-base font-medium text-gray-900">{ctx.title}</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ctx.description}</p>
          {ctx.address && (
            <p className="flex items-start gap-1 text-sm text-gray-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {ctx.address}
            </p>
          )}
          {ctx.attachments.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('complaints.detail.section.attachments')}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {ctx.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={getFileUrl(a.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                  >
                    {a.mime?.startsWith('image/') ? (
                      <img src={getFileUrl(a.url)} alt={a.filename} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-xs text-gray-500">
                        {a.filename}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
          {hasComplaintAccess && (
            <Link
              href={`/complaints/${hr.complaintId}`}
              className="inline-block text-sm text-brand-600 hover:underline"
            >
              {t('helpRequests.detail.viewComplaint')}
            </Link>
          )}
        </div>
      )}

      {(hr.solutionNotes || (hr.solutionAttachments?.length ?? 0) > 0) && (
        <div className="gov-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">{t('helpRequests.detail.resultSection')}</h2>
          {hr.solutionNotes && (
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{hr.solutionNotes}</p>
          )}
          {Array.isArray(hr.solutionAttachments) && hr.solutionAttachments.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {hr.solutionAttachments.map((a, i) => (
                <a
                  key={i}
                  href={getFileUrl(a.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square overflow-hidden rounded-lg border border-gray-200"
                >
                  {a.mime?.startsWith('image/') ? (
                    <img src={getFileUrl(a.url)} alt={a.filename} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center p-2 text-xs">{a.filename}</span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {detail.timeline.length > 0 && (
        <div className="gov-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('helpRequests.detail.timeline')}</h2>
          <ul className="space-y-3 border-s-2 border-amber-200 ps-4">
            {detail.timeline.map((ev) => (
              <li key={ev.id} className="text-sm">
                <div className="text-xs text-gray-500">{formatDate(ev.createdAt, 'MMM d, HH:mm')}</div>
                <div className="font-medium text-gray-800">
                  {ev.eventKind && EVENT_LABELS[ev.eventKind]
                    ? t(EVENT_LABELS[ev.eventKind])
                    : ev.eventKind}
                </div>
                {ev.notes && <p className="text-gray-600">{ev.notes}</p>}
                {ev.changedBy && (
                  <p className="text-xs text-gray-400">{getFullName(ev.changedBy)}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isTerminal && (
        <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
          {canApproveSource && (
            <ActionBtn onClick={() => approveSource.mutate()} loading={approveSource.isPending} variant="success">
              <CheckCircle2 className="h-4 w-4" /> {t('helpRequests.action.approveSource')}
            </ActionBtn>
          )}
          {canRejectSource && (
            <ActionBtn onClick={() => setShowRejectSource(true)} variant="danger">
              <XCircle className="h-4 w-4" /> {t('helpRequests.action.rejectSource')}
            </ActionBtn>
          )}
          {canAccept && (
            <ActionBtn onClick={() => accept.mutate()} loading={accept.isPending} variant="primary">
              <CheckCircle2 className="h-4 w-4" /> {t('common.confirm')}
            </ActionBtn>
          )}
          {canDecline && (
            <ActionBtn onClick={() => setShowDecline(true)} variant="danger">
              <XCircle className="h-4 w-4" /> {t('helpRequests.toast.declined')}
            </ActionBtn>
          )}
          {canAssign && (
            <ActionBtn onClick={() => setShowAssign(true)} variant="secondary">
              <ShieldCheck className="h-4 w-4" /> {t('helpRequests.toast.assigned')}
            </ActionBtn>
          )}
          {canSubmit && (
            <ActionBtn onClick={() => setShowSubmit(true)} variant="primary">
              <UploadCloud className="h-4 w-4" /> {t('helpRequests.action.submitResult')}
            </ActionBtn>
          )}
          {canApproveResult && (
            <ActionBtn onClick={() => approve.mutate()} loading={approve.isPending} variant="success">
              <CheckCircle2 className="h-4 w-4" /> {t('helpRequests.toast.approved')}
            </ActionBtn>
          )}
          {canRejectResult && (
            <ActionBtn onClick={() => setShowReject(true)} variant="danger">
              <XCircle className="h-4 w-4" /> {t('helpRequests.toast.resultRejected')}
            </ActionBtn>
          )}
          {canCancel && (
            <ActionBtn
              onClick={() => { if (confirm(t('helpRequests.confirm.cancel'))) cancel.mutate(); }}
              variant="secondary"
            >
              <Trash2 className="h-4 w-4" /> {t('common.cancel')}
            </ActionBtn>
          )}
        </div>
      )}

      {showAssign && <AssignModal hr={hr} onClose={() => setShowAssign(false)} onChanged={invalidate} />}
      {showSubmit && <SubmitModal hr={hr} onClose={() => setShowSubmit(false)} onChanged={invalidate} />}
      {showDecline && (
        <ModalShell title={t('helpRequests.toast.declined')} onClose={() => setShowDecline(false)}>
          <textarea
            className="input-gov w-full"
            rows={4}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder={t('helpRequests.field.reason.placeholder')}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-gov-secondary" onClick={() => setShowDecline(false)}>{t('common.cancel')}</button>
            <button
              className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={declineReason.trim().length < 5}
              onClick={async () => {
                try {
                  await helpRequestsApi.decline(hr.id, { note: declineReason });
                  toast.success(t('helpRequests.toast.declined'));
                  setShowDecline(false);
                  invalidate();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              {t('common.confirm')}
            </button>
          </div>
        </ModalShell>
      )}
      {showReject && (
        <ModalShell title={t('helpRequests.toast.resultRejected')} onClose={() => setShowReject(false)}>
          <textarea
            className="input-gov w-full"
            rows={4}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-gov-secondary" onClick={() => setShowReject(false)}>{t('common.cancel')}</button>
            <button
              className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white"
              disabled={declineReason.trim().length < 5}
              onClick={async () => {
                try {
                  await helpRequestsApi.reject(hr.id, { reason: declineReason });
                  toast.success(t('helpRequests.toast.resultRejected'));
                  setShowReject(false);
                  invalidate();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              {t('common.confirm')}
            </button>
          </div>
        </ModalShell>
      )}
      {showRejectSource && (
        <ModalShell title={t('helpRequests.action.rejectSource')} onClose={() => setShowRejectSource(false)}>
          <textarea
            className="input-gov w-full"
            rows={4}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-gov-secondary" onClick={() => setShowRejectSource(false)}>{t('common.cancel')}</button>
            <button
              className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white"
              disabled={declineReason.trim().length < 5}
              onClick={async () => {
                try {
                  await helpRequestsApi.rejectSource(hr.id, { note: declineReason });
                  toast.success(t('helpRequests.toast.sourceRejected'));
                  setShowRejectSource(false);
                  invalidate();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              {t('common.confirm')}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function ActionBtn({
  children, onClick, loading, variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant: 'primary' | 'success' | 'danger' | 'secondary';
}) {
  const cls =
    variant === 'primary'
      ? 'border-amber-700 bg-amber-600 text-white hover:bg-amber-700'
      : variant === 'success'
        ? 'border-green-700 bg-green-600 text-white hover:bg-green-700'
        : variant === 'danger'
          ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${cls}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function ModalShell({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded border bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function AssignModal({
  hr, onClose, onChanged,
}: { hr: HelpRequestDetail; onClose: () => void; onChanged: () => void }) {
  const t = useTranslate();
  const [assigneeId, setAssigneeId] = useState(hr.helperAssigneeId ?? '');
  const { data: membersResp, isLoading } = useQuery({
    queryKey: ['department', hr.toDepartmentId, 'members'],
    queryFn: () => departmentsApi.listMembers(hr.toDepartmentId),
  });
  const members = (membersResp as any)?.members ?? [];
  const submit = useMutation({
    mutationFn: () => helpRequestsApi.assign(hr.id, { helperAssigneeId: assigneeId }),
    onSuccess: () => { toast.success(t('helpRequests.toast.assigned')); onChanged(); onClose(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  return (
    <ModalShell title={t('helpRequests.toast.assigned')} onClose={onClose}>
      {isLoading ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      ) : (
        <ul className="max-h-64 divide-y overflow-y-auto rounded border">
          {members.map((m: any) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setAssigneeId(m.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${assigneeId === m.id ? 'bg-amber-50' : ''}`}
              >
                {getFullName(m)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-gov-secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={!assigneeId || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {t('roles.btn.assign')}
        </button>
      </div>
    </ModalShell>
  );
}

function SubmitModal({
  hr, onClose, onChanged,
}: { hr: HelpRequestDetail; onClose: () => void; onChanged: () => void }) {
  const t = useTranslate();
  const [notes, setNotes] = useState('');
  const submit = useMutation({
    mutationFn: () => helpRequestsApi.submit(hr.id, { notes: notes.trim(), attachments: [] }),
    onSuccess: () => { toast.success(t('helpRequests.toast.submitted')); onChanged(); onClose(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  return (
    <ModalShell title={t('helpRequests.action.submitResult')} onClose={onClose}>
      <textarea
        className="input-gov w-full"
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('helpRequests.field.reason.placeholder')}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-gov-secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={notes.trim().length < 5 || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {t('common.submit')}
        </button>
      </div>
    </ModalShell>
  );
}
