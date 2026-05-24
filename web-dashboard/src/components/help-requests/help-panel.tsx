'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2, ChevronDown, HandHelping, Loader2, Paperclip,
  ShieldCheck, Trash2, UploadCloud, X, XCircle,
} from 'lucide-react';
import { ApiError, helpRequestsApi, getFileUrl, departmentsApi } from '@/lib/api';
import type { HelpRequest, HelpRequestStatus } from '@shared/types/help-request';
import { useAuthStore } from '@/lib/auth';
import { formatDate, getFullName } from '@/lib/utils';
import { useTranslate, useLocale, isRtl, pickName, type MessageKey } from '@/lib/i18n';

interface Props {
  complaintId: string;
  complaintTitle: string;
}

const STATUS_STYLE: Record<HelpRequestStatus, { labelKey: MessageKey; cls: string }> = {
  PENDING:     { labelKey: 'helpRequests.status.PENDING',      cls: 'bg-yellow-100 text-yellow-800' },
  ACCEPTED:    { labelKey: 'helpRequests.status.ACCEPTED',     cls: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { labelKey: 'helpRequests.status.IN_PROGRESS',  cls: 'bg-blue-100 text-blue-800' },
  SUBMITTED:   { labelKey: 'helpRequests.status.SUBMITTED',    cls: 'bg-purple-100 text-purple-800' },
  COMPLETED:   { labelKey: 'helpRequests.status.APPROVED',     cls: 'bg-green-100 text-green-800' },
  DECLINED:    { labelKey: 'helpRequests.status.DECLINED',     cls: 'bg-rose-100 text-rose-800' },
  REJECTED:    { labelKey: 'helpRequests.status.DECLINED',     cls: 'bg-rose-100 text-rose-800' },
  CANCELLED:   { labelKey: 'helpRequests.status.CANCELED',     cls: 'bg-gray-100 text-gray-700' },
};

/**
 * One stop shop for all help-request UX on a complaint detail page:
 *   - Shows the active help request (if any) with the right action buttons
 *     for each role (requester, helper HOD, helper assignee, original HOD).
 *   - Shows historical help-requests as a collapsible timeline.
 */
export function HelpPanel({ complaintId, complaintTitle }: Props) {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user) as any;
  const t = useTranslate();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['help-requests', 'complaint', complaintId],
    queryFn: () => helpRequestsApi.historyForComplaint(complaintId),
  });

  const active = useMemo(
    () => history.find((h) => !['COMPLETED', 'DECLINED', 'REJECTED', 'CANCELLED'].includes(h.status)),
    [history],
  );
  const archived = useMemo(
    () => history.filter((h) => h !== active),
    [history, active],
  );

  if (isLoading) {
    return (
      <div className="gov-card p-4 text-sm text-gray-500">
        <Loader2 className="inline h-4 w-4 animate-spin" /> {t('common.loading')}
      </div>
    );
  }

  if (history.length === 0) return null;

  return (
    <div className="space-y-4">
      {active && (
        <ActiveHelpCard
          hr={active}
          complaintTitle={complaintTitle}
          me={me}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['help-requests', 'complaint', complaintId] });
            queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
          }}
        />
      )}
      {archived.length > 0 && <ArchivedList items={archived} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Active help-request card
// ────────────────────────────────────────────────────────────────────────────
function ActiveHelpCard({
  hr, complaintTitle, me, onChanged,
}: {
  hr: HelpRequest; complaintTitle: string; me: any; onChanged: () => void;
}) {
  const t = useTranslate();
  const locale = useLocale();
  const isHelperHod = me?.id && hr.toDepartment?.headUserId === me.id;
  const isOriginalHod = me?.id && hr.fromDepartment?.headUserId === me.id;
  const isAssignedHelper = me?.id && hr.helperAssigneeId === me.id;
  const isRequester = me?.id === hr.requestedById;
  const isAdmin = !!me?.isSuperAdmin || (me?.permissions ?? []).includes('complaint.view_all');

  const style = STATUS_STYLE[hr.status];

  const [showAssign, setShowAssign] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const accept = useMutation({
    mutationFn: () => helpRequestsApi.accept(hr.id, {}),
    onSuccess: () => { toast.success(t('helpRequests.toast.accepted')); onChanged(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: () => helpRequestsApi.cancel(hr.id),
    onSuccess: () => { toast.success(t('helpRequests.toast.cancelled')); onChanged(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: () => helpRequestsApi.approve(hr.id, {}),
    onSuccess: () => { toast.success(t('helpRequests.toast.approved')); onChanged(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const canAccept = hr.status === 'PENDING' && (isHelperHod || isAdmin);
  const canDecline = hr.status === 'PENDING' && (isHelperHod || isAdmin);
  const canCancel =
    ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(hr.status) &&
    (isRequester || isOriginalHod || isAdmin);
  const canAssign =
    ['ACCEPTED', 'IN_PROGRESS'].includes(hr.status) && (isHelperHod || isAdmin);
  const canSubmit =
    ['ACCEPTED', 'IN_PROGRESS'].includes(hr.status) &&
    (isAssignedHelper || isHelperHod || isAdmin);
  const canApprove = hr.status === 'SUBMITTED' && (isOriginalHod || isAdmin);
  const canReject = hr.status === 'SUBMITTED' && (isOriginalHod || isAdmin);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HandHelping className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold text-gray-900">
              {t('helpRequests.panel.title')} — {hr.fromDepartment ? pickName(hr.fromDepartment as any, locale) : '—'} → {hr.toDepartment ? pickName(hr.toDepartment as any, locale) : '—'}
            </h3>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.cls}`}>
              {t(style.labelKey)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('helpRequests.panel.requester')}: {hr.requestedBy ? getFullName(hr.requestedBy) : '—'} · {formatDate(hr.createdAt, 'MMM d, yyyy HH:mm')}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <Field label={t('helpRequests.panel.reason')} value={hr.reason} />
        {hr.helperAssignee && (
          <Field label={t('helpRequests.panel.assignee')} value={`${hr.helperAssignee.firstName} ${hr.helperAssignee.lastName}`} />
        )}
        {hr.respondedBy && hr.responseReason && (
          <Field label={t('common.notes')} value={hr.responseReason} />
        )}
        {hr.solutionNotes && (
          <Field label={t('helpRequests.panel.solution')} value={hr.solutionNotes} />
        )}
      </div>

      {Array.isArray(hr.solutionAttachments) && hr.solutionAttachments.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            <Paperclip className="h-3.5 w-3.5" /> {t('helpRequests.panel.proof')}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {hr.solutionAttachments.map((a, i) => (
              <a
                key={i}
                href={getFileUrl(a.url)}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-lg border border-amber-200 bg-white"
                title={a.filename}
              >
                {a.mime?.startsWith('image/') ? (
                  <img src={getFileUrl(a.url)} alt={a.filename} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-500 p-2">
                    {a.filename}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-200 pt-3">
        {canAccept && (
          <button onClick={() => accept.mutate()} disabled={accept.isPending}
            className="inline-flex items-center gap-1.5 rounded border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {t('common.confirm')}
          </button>
        )}
        {canDecline && (
          <button onClick={() => setShowDecline(true)}
            className="inline-flex items-center gap-1.5 rounded border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">
            <XCircle className="h-4 w-4" /> {t('helpRequests.toast.declined')}
          </button>
        )}
        {canAssign && (
          <button onClick={() => setShowAssign(true)}
            className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100">
            <ShieldCheck className="h-4 w-4" /> {t('helpRequests.toast.assigned')}
          </button>
        )}
        {canSubmit && (
          <button onClick={() => setShowSubmit(true)}
            className="inline-flex items-center gap-1.5 rounded border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
            <UploadCloud className="h-4 w-4" /> {t('common.submit')}
          </button>
        )}
        {canApprove && (
          <button onClick={() => approve.mutate()} disabled={approve.isPending}
            className="inline-flex items-center gap-1.5 rounded border border-green-700 bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {t('common.confirm')}
          </button>
        )}
        {canReject && (
          <button onClick={() => setShowReject(true)}
            className="inline-flex items-center gap-1.5 rounded border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">
            <XCircle className="h-4 w-4" /> {t('common.reject' as any) || t('helpRequests.toast.declined')}
          </button>
        )}
        {canCancel && (
          <button onClick={() => { if (confirm(t('helpRequests.confirm.cancel'))) cancel.mutate(); }}
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Trash2 className="h-4 w-4" /> {t('common.cancel')}
          </button>
        )}
      </div>

      {showAssign && (
        <AssignHelperModal hr={hr} onClose={() => setShowAssign(false)} onChanged={onChanged} />
      )}
      {showSubmit && (
        <SubmitHelpModal hr={hr} onClose={() => setShowSubmit(false)} onChanged={onChanged} />
      )}
      {showDecline && (
        <ReasonModal
          title={t('helpRequests.toast.declined')}
          confirmLabel={t('common.confirm')}
          danger
          onClose={() => setShowDecline(false)}
          onSubmit={async (reason) => {
            try { await helpRequestsApi.decline(hr.id, { note: reason }); toast.success(t('helpRequests.toast.declined')); onChanged(); setShowDecline(false); }
            catch (e: any) { toast.error(e.message ?? t('common.error')); }
          }}
        />
      )}
      {showReject && (
        <ReasonModal
          title={t('helpRequests.toast.declined')}
          confirmLabel={t('common.confirm')}
          danger
          onClose={() => setShowReject(false)}
          onSubmit={async (reason) => {
            try { await helpRequestsApi.reject(hr.id, { reason }); toast.success(t('helpRequests.toast.declined')); onChanged(); setShowReject(false); }
            catch (e: any) { toast.error(e.message ?? t('common.error')); }
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Archived help-requests collapsible
// ────────────────────────────────────────────────────────────────────────────
function ArchivedList({ items }: { items: HelpRequest[] }) {
  const t = useTranslate();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <div className="gov-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2"
      >
        <span className="text-sm font-semibold text-gray-700">
          {t('helpRequests.section.outgoing')} ({items.length})
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4">
          {items.map((h) => {
            const s = STATUS_STYLE[h.status];
            return (
              <div key={h.id} className="rounded bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">
                    {h.fromDepartment ? pickName(h.fromDepartment as any, locale) : '—'} → {h.toDepartment ? pickName(h.toDepartment as any, locale) : '—'}
                  </div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                    {t(s.labelKey)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{h.reason}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {formatDate(h.createdAt, 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Reason modal (decline / reject)
// ────────────────────────────────────────────────────────────────────────────
function ReasonModal({
  title, confirmLabel, danger, onClose, onSubmit,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const t = useTranslate();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded border border-gray-200 bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('helpRequests.field.reason.placeholder')}
          className="input-gov mt-3"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-gov-secondary">{t('common.cancel')}</button>
          <button
            disabled={busy || reason.trim().length < 5}
            onClick={async () => { setBusy(true); try { await onSubmit(reason.trim()); } finally { setBusy(false); } }}
            className={`rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-600 hover:bg-brand-700'}`}
          >
            {busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Assign helper worker (helper HOD picks one of their team)
// ────────────────────────────────────────────────────────────────────────────
function AssignHelperModal({
  hr, onClose, onChanged,
}: { hr: HelpRequest; onClose: () => void; onChanged: () => void }) {
  const t = useTranslate();
  const locale = useLocale();
  const [assigneeId, setAssigneeId] = useState(hr.helperAssigneeId ?? '');
  const { data: membersResp } = useQuery({
    queryKey: ['department', hr.toDepartmentId, 'members'],
    queryFn: () => departmentsApi.listMembers(hr.toDepartmentId),
    enabled: !!hr.toDepartmentId,
  });
  const members = (membersResp as any)?.members ?? [];
  const submit = useMutation({
    mutationFn: () => helpRequestsApi.assign(hr.id, { helperAssigneeId: assigneeId }),
    onSuccess: () => { toast.success(t('helpRequests.toast.assigned')); onChanged(); onClose(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded border border-gray-200 bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900">{t('helpRequests.toast.assigned')}</h3>
        <p className="mt-1 text-xs text-gray-500">
          {hr.toDepartment ? pickName(hr.toDepartment as any, locale) : ''}
        </p>
        <div className="mt-3 max-h-64 overflow-y-auto rounded border border-gray-200">
          {members.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">{t('departments.member.empty')}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((m: any) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setAssigneeId(m.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${assigneeId === m.id ? 'bg-amber-50' : ''}`}
                  >
                    <span className="text-gray-900">{getFullName(m)}</span>
                    <span className="text-xs text-gray-500">{m.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-gov-secondary">{t('common.cancel')}</button>
          <button
            onClick={() => submit.mutate()}
            disabled={!assigneeId || submit.isPending}
            className="inline-flex items-center gap-1.5 rounded border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('roles.btn.assign')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Submit helper work
// ────────────────────────────────────────────────────────────────────────────
function SubmitHelpModal({
  hr, onClose, onChanged,
}: { hr: HelpRequest; onClose: () => void; onChanged: () => void }) {
  const t = useTranslate();
  const [notes, setNotes] = useState('');
  const submit = useMutation({
    mutationFn: () => helpRequestsApi.submit(hr.id, { notes: notes.trim(), attachments: [] }),
    onSuccess: () => { toast.success(t('helpRequests.toast.submitted')); onChanged(); onClose(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded border border-gray-200 bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-gray-900">{t('helpRequests.panel.solution')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('helpRequests.field.reason.placeholder')}
          className="input-gov mt-3"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-gov-secondary">{t('common.cancel')}</button>
          <button
            disabled={notes.trim().length < 5 || submit.isPending}
            onClick={() => submit.mutate()}
            className="inline-flex items-center gap-1.5 rounded border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
