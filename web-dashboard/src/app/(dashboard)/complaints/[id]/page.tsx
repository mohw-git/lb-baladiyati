'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { complaintsApi, transfersApi, helpRequestsApi, ApiError, getFileUrl } from '@/lib/api';
import { TransferModal } from '@/components/transfers/transfer-modal';
import { TransferTimeline } from '@/components/transfers/transfer-timeline';
import { RequestHelpModal } from '@/components/help-requests/request-help-modal';
import { HelpPanel } from '@/components/help-requests/help-panel';
import { usePermission, useAnyPermission, useAuthStore } from '@/lib/auth';
import { PERMISSIONS } from '@shared/constants/permissions';
import { ComplaintStatus, ComplaintPriority, RejectionReason } from '@shared/types/complaint';
import { STATUS_LABELS } from '@shared/constants/status';
import { StatusBadge } from '@/components/features/complaints/status-badge';
import { UnverifiedSubmitterBadge } from '@/components/features/complaints/unverified-submitter-badge';
import { PriorityBadge } from '@/components/features/complaints/priority-badge';
import type { ComplaintRiskReason } from '@shared/types/complaint';
import { formatDate, getFullName } from '@/lib/utils';
import {
  ArrowLeft, MapPin, Calendar, User as UserIcon, Tag, Building,
  Paperclip, History, UserPlus, RefreshCw, Loader2, Trash2, Image, Flag, XCircle, Send,
  HandHelping, Eye, CheckCircle, RotateCcw,
} from 'lucide-react';
import { useTranslate, useLocale, isRtl, pickName } from '@/lib/i18n';

/**
 * Complaint statuses where new assignment / reassignment is operationally
 * meaningful. Keep in sync with the backend ASSIGNABLE_STATUSES guard.
 */
const ASSIGNABLE_STATUSES = new Set<string>([
  ComplaintStatus.SUBMITTED,
  ComplaintStatus.UNDER_REVIEW,
  ComplaintStatus.ASSIGNED,
]);

/**
 * Statuses where a help request is operationally meaningful. Keep in sync
 * with the backend HELP_REQUESTABLE_STATUSES guard.
 */
const HELP_REQUESTABLE_STATUSES = new Set<string>([
  ComplaintStatus.ASSIGNED,
  ComplaintStatus.IN_PROGRESS,
  ComplaintStatus.PENDING_APPROVAL,
]);

/** Help-request lifecycle statuses considered active (non-terminal). */
const ACTIVE_HELP_STATUSES = new Set<string>([
  'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED',
]);

/** Transfer lifecycle status considered active (non-terminal). */
const ACTIVE_TRANSFER_STATUSES = new Set<string>(['PENDING']);

/** Prefer backend `currentAssignment`; fall back to newest active row in `assignments`. */
function resolveCurrentAssignment(complaint: {
  currentAssignment?: unknown;
  assignments?: { isActive?: boolean; createdAt?: string; assignedTo?: unknown }[];
} | null | undefined) {
  const ca = complaint?.currentAssignment as {
    assignedTo?: unknown;
    isAssigned?: boolean;
  } | null | undefined;
  if (ca?.assignedTo) return ca;
  const list = complaint?.assignments;
  if (Array.isArray(list) && list.length > 0) {
    const active = list.filter((a) => a.isActive);
    if (active.length > 0) {
      return [...active].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      )[0];
    }
  }
  return ca?.isAssigned ? ca : null;
}

const TERMINAL_STATUSES = new Set<string>([
  ComplaintStatus.COMPLETED,
  ComplaintStatus.CLOSED,
  ComplaintStatus.REJECTED,
]);

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);

  const { user } = useAuthStore();
  const canAssign = usePermission(PERMISSIONS.COMPLAINT_ASSIGN);
  const canChangeStatus = usePermission(PERMISSIONS.COMPLAINT_CHANGE_STATUS);
  const canSetPriority = usePermission(PERMISSIONS.COMPLAINT_SET_PRIORITY);
  const canReject = usePermission(PERMISSIONS.COMPLAINT_REJECT);
  const canTransfer = usePermission(PERMISSIONS.TRANSFER_REQUEST);
  const canHelpRequest = usePermission(PERMISSIONS.HELP_REQUEST);
  const canDelete = usePermission(PERMISSIONS.COMPLAINT_VIEW_ALL);
  const canApproveClosure = useAnyPermission(
    PERMISSIONS.COMPLAINT_APPROVE,
    PERMISSIONS.COMPLAINT_VIEW_ALL,
  );
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [newStatus, setNewStatus] = useState<ComplaintStatus>(ComplaintStatus.IN_PROGRESS);
  const [statusNotes, setStatusNotes] = useState('');
  const [newPriority, setNewPriority] = useState<ComplaintPriority>(ComplaintPriority.MEDIUM);
  const [priorityDueDate, setPriorityDueDate] = useState('');
  const [rejectReason, setRejectReason] = useState<RejectionReason>(RejectionReason.INSUFFICIENT_INFO);
  const [rejectNotes, setRejectNotes] = useState('');

  const { data: complaint, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintsApi.getById(id),
  });

  // The complaint detail page lives next to the HelpPanel, which already
  // fetches help-history for this complaint. We do the same fetch here so
  // the action buttons (Request Help / Transfer) can be properly disabled
  // when an active request exists — instead of letting the user click the
  // button and discover via toast that backend rejects it.
  const { data: helpHistory = [] } = useQuery({
    queryKey: ['help-requests', 'complaint', id],
    queryFn: () => helpRequestsApi.historyForComplaint(id),
    enabled: !!id,
  });
  const activeHelpRequest = useMemo(
    () => helpHistory.find((h: any) => ACTIVE_HELP_STATUSES.has(h.status)),
    [helpHistory],
  );

  const { data: transferHistory = [] } = useQuery({
    queryKey: ['complaint', id, 'transfers'],
    queryFn: async () => {
      // Listing scoped to this complaint via the targetType filter; final
      // narrowing happens client-side because the API doesn't accept
      // targetId on the list endpoint.
      const res = await transfersApi.list({ targetType: 'COMPLAINT', limit: 100 });
      return res.items.filter((t: any) => t.targetId === id);
    },
    enabled: !!id,
  });
  const activeTransfer = useMemo(
    () => transferHistory.find((t: any) => ACTIVE_TRANSFER_STATUSES.has(t.status)),
    [transferHistory],
  );

  const { data: assignableUsers } = useQuery({
    queryKey: ['complaint', id, 'assignable-users'],
    queryFn: () => complaintsApi.listAssignableUsers(id),
    enabled: showAssignModal,
  });

  // Derived UI state. Keep these as plain const so it's obvious which
  // conditions apply to each button — easier to audit than mixing them
  // inline in JSX. Each `reason` is shown via `title` for disabled buttons.
  const activeAssignment = useMemo(
    () => resolveCurrentAssignment(complaint as any),
    [complaint],
  );

  const status = complaint?.status;
  const isPreview = (complaint as any)?.previewOnly === true;
  const isTerminal = !!status && TERMINAL_STATUSES.has(status);
  const isAssigned = !!activeAssignment?.assignedTo || !!(activeAssignment as any)?.isAssigned;
  const hasDepartment = !!complaint?.department?.id;

  const assignState: { show: boolean; disabled: boolean; reason: string; label: string } = {
    show: canAssign && !isPreview,
    disabled: false,
    reason: '',
    label: isAssigned ? t('complaints.detail.action.reassign') : t('complaints.detail.action.assign'),
  };
  if (assignState.show) {
    if (!status || !ASSIGNABLE_STATUSES.has(status)) {
      assignState.disabled = true;
      assignState.reason = isTerminal
        ? t('complaints.detail.action.disabled.terminal')
        : t('complaints.detail.action.disabled.statusLockedForAssign');
    }
  }

  const helpState = { show: canHelpRequest && hasDepartment && !isPreview, disabled: false, reason: '' };
  if (helpState.show) {
    if (!status || !HELP_REQUESTABLE_STATUSES.has(status)) {
      helpState.disabled = true;
      helpState.reason = t('complaints.detail.action.disabled.helpNeedsAssignment');
    } else if (activeHelpRequest) {
      helpState.disabled = true;
      helpState.reason = t('complaints.detail.action.disabled.activeHelpExists');
    }
  }

  const transferState = { show: canTransfer && hasDepartment && !isPreview, disabled: false, reason: '' };
  if (transferState.show) {
    if (isTerminal) {
      transferState.disabled = true;
      transferState.reason = t('complaints.detail.action.disabled.terminal');
    } else if (activeTransfer) {
      transferState.disabled = true;
      transferState.reason = t('complaints.detail.action.disabled.activeTransferExists');
    }
  }

  const priorityState = { show: canSetPriority && !isPreview, disabled: isTerminal, reason: isTerminal ? t('complaints.detail.action.disabled.terminal') : '' };
  const rejectState = { show: canReject && !isPreview && !isTerminal, disabled: false, reason: '' };

  const isPendingApproval = status === ComplaintStatus.PENDING_APPROVAL;
  const assigneeId = (activeAssignment as { assignedTo?: { id?: string } } | null)?.assignedTo?.id;
  const userDeptId = user?.department?.id;
  const complaintDeptId = complaint?.department?.id;
  const canViewAllComplaints = usePermission(PERMISSIONS.COMPLAINT_VIEW_ALL);

  const approvalState: { show: boolean; enabled: boolean; reason: string } = {
    show: false,
    enabled: false,
    reason: '',
  };
  if (isPendingApproval && !isPreview && canApproveClosure) {
    approvalState.show = true;
    if (canViewAllComplaints) {
      approvalState.enabled = true;
    } else if (!complaintDeptId) {
      approvalState.reason = t('complaints.detail.action.disabled.approveNoDepartment');
    } else if (userDeptId !== complaintDeptId) {
      approvalState.reason = t('complaints.detail.action.disabled.approveWrongDepartment');
    } else if (assigneeId && assigneeId === user?.id) {
      approvalState.reason = t('complaints.detail.action.disabled.approveOwnWork');
    } else {
      approvalState.enabled = true;
    }
  }

  const statusState = {
    show: canChangeStatus && !isPreview && !isTerminal && !(isPendingApproval && canApproveClosure),
    disabled: false,
    reason: '',
  };

  const assignMutation = useMutation({
    mutationFn: () => complaintsApi.assign(id, { assignedToId: assignUserId, notes: assignNotes }),
    onSuccess: () => {
      toast.success(t('complaints.toast.assigned'));
      setShowAssignModal(false);
      setAssignUserId('');
      setAssignNotes('');
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: () => complaintsApi.changeStatus(id, { status: newStatus, notes: statusNotes }),
    onSuccess: () => {
      toast.success(t('complaints.toast.statusChanged'));
      setShowStatusModal(false);
      setStatusNotes('');
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const approveCompletionMutation = useMutation({
    mutationFn: () =>
      complaintsApi.changeStatus(id, { status: ComplaintStatus.COMPLETED }),
    onSuccess: () => {
      toast.success(t('complaints.toast.approved'));
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const returnForWorkMutation = useMutation({
    mutationFn: () =>
      complaintsApi.changeStatus(id, {
        status: ComplaintStatus.IN_PROGRESS,
        notes: returnNotes.trim(),
      }),
    onSuccess: () => {
      toast.success(t('complaints.toast.returnedForWork'));
      setShowReturnModal(false);
      setReturnNotes('');
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => complaintsApi.remove(id),
    onSuccess: () => {
      toast.success(t('complaints.toast.deleted'));
      router.push('/complaints');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const priorityMutation = useMutation({
    mutationFn: () => complaintsApi.setPriority(id, {
      priority: newPriority,
      dueDate: priorityDueDate || undefined,
    }),
    onSuccess: () => {
      toast.success(t('complaints.toast.statusChanged'));
      setShowPriorityModal(false);
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => complaintsApi.reject(id, {
      reason: rejectReason,
      notes: rejectNotes || undefined,
    }),
    onSuccess: () => {
      toast.success(t('complaints.toast.rejected'));
      setShowRejectModal(false);
      setRejectNotes('');
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">{t('common.noResults')}</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between border-b border-gray-200 pb-4">
        <div>
          <Link href="/complaints" className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.complaints')}
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{complaint.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="font-mono">{complaint.referenceCode}</span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            {complaint.isRiskySubmission && (
              <UnverifiedSubmitterBadge
                riskReasons={complaint.riskReasons as ComplaintRiskReason[] | undefined}
              />
            )}
          </div>
          {complaint.isRiskySubmission && (
            <p className="mt-1 text-xs text-amber-800">{t('complaints.risk.forcedLow')}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {approvalState.show && (
            <>
              <button
                type="button"
                onClick={() => approvalState.enabled && approveCompletionMutation.mutate()}
                disabled={!approvalState.enabled || approveCompletionMutation.isPending}
                title={!approvalState.enabled ? approvalState.reason : undefined}
                className="flex items-center gap-1.5 rounded border border-green-600 bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green-600"
              >
                {approveCompletionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {t('complaints.detail.action.approveCompletion')}
              </button>
              <button
                type="button"
                onClick={() => approvalState.enabled && setShowReturnModal(true)}
                disabled={!approvalState.enabled || returnForWorkMutation.isPending}
                title={!approvalState.enabled ? approvalState.reason : undefined}
                className="flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-50"
              >
                <RotateCcw className="h-4 w-4" />
                {t('complaints.detail.action.returnForWork')}
              </button>
            </>
          )}
          {assignState.show && (
            <button
              onClick={() => !assignState.disabled && setShowAssignModal(true)}
              disabled={assignState.disabled}
              title={assignState.disabled ? assignState.reason : undefined}
              className="btn-gov-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" /> {assignState.label}
            </button>
          )}
          {helpState.show && (
            <button
              onClick={() => !helpState.disabled && setShowHelpModal(true)}
              disabled={helpState.disabled}
              title={helpState.disabled ? helpState.reason : undefined}
              className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-50"
            >
              <HandHelping className="h-4 w-4" /> {t('complaints.detail.action.askHelp')}
            </button>
          )}
          {transferState.show && (
            <button
              onClick={() => !transferState.disabled && setShowTransferModal(true)}
              disabled={transferState.disabled}
              title={transferState.disabled ? transferState.reason : undefined}
              className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-purple-50"
            >
              <Send className="h-4 w-4" /> {t('complaints.detail.action.transfer')}
            </button>
          )}
          {priorityState.show && (
            <button
              onClick={() => {
                if (priorityState.disabled) return;
                setNewPriority(complaint.priority || ComplaintPriority.MEDIUM);
                setPriorityDueDate(complaint.dueDate ? new Date(complaint.dueDate).toISOString().slice(0, 16) : '');
                setShowPriorityModal(true);
              }}
              disabled={priorityState.disabled}
              title={priorityState.disabled ? priorityState.reason : undefined}
              className="btn-gov-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Flag className="h-4 w-4" /> {t('common.priority')}
            </button>
          )}
          {rejectState.show && (
            <button
              onClick={() => setShowRejectModal(true)}
              className="flex items-center gap-1.5 rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" /> {t('complaints.detail.action.reject')}
            </button>
          )}
          {statusState.show && (
            <button
              onClick={() => setShowStatusModal(true)}
              className="btn-gov-primary"
            >
              <RefreshCw className="h-4 w-4" /> {t('common.status')}
            </button>
          )}
          {canDelete && !isPreview && (
            <button
              onClick={() => { if (confirm(t('complaints.detail.deleteConfirm'))) deleteMutation.mutate(); }}
              title={t('common.delete')}
              className="rounded border border-red-200 p-2 text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Preview-only banner: receiver HOD/Supervisor reading a complaint
          they only see because there's a pending transfer/help request
          aimed at their department. */}
      {isPreview && (
        <div className="flex items-start gap-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">{t('complaints.detail.preview.title')}</div>
            <div className="mt-0.5 text-blue-800">{t('complaints.detail.preview.subtitle')}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="gov-card p-4">
            <div className="gov-section-header">{t('common.description')}</div>
            <p className="mt-3 whitespace-pre-wrap text-gray-700">{complaint.description}</p>
          </div>

          <HelpPanel complaintId={id} complaintTitle={complaint.title} />

          {complaint.attachments?.length > 0 && (
            <div className="gov-card p-4">
              <div className="gov-section-header">
                <Paperclip className="h-4 w-4" /> {t('common.attachments')} ({complaint.attachments.length})
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {complaint.attachments.map((a) => (
                  <a key={a.id} href={getFileUrl(a.url)} target="_blank" rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded border border-gray-200 bg-gray-50"
                  >
                    {a.type === 'IMAGE' ? (
                      <img src={getFileUrl(a.url)} alt={a.filename} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Image className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {(complaint.statusHistory || (complaint as any).statusLogs)?.length > 0 && (
            <div className="gov-card p-4">
              <div className="gov-section-header">
                <History className="h-4 w-4" /> {t('complaints.detail.section.timeline')}
              </div>
              <div className="mt-3 space-y-3">
                {(complaint.statusHistory || (complaint as any).statusLogs).map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 rounded bg-gray-50 p-3">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-brand-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        {log.fromStatus && (
                          <><StatusBadge status={log.fromStatus} /> &rarr; </>
                        )}
                        <StatusBadge status={log.toStatus} />
                      </p>
                      {log.notes && <p className="mt-1 text-xs text-gray-500">{log.notes}</p>}
                      <p className="mt-1 text-xs text-gray-400">
                        {getFullName(log.changedBy)} · {formatDate(log.createdAt, 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="gov-card p-4">
            <div className="gov-section-header">{t('complaints.detail.section.details')}</div>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Tag className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <dt className="font-medium text-gray-500">{t('common.category')}</dt>
                  <dd className="text-gray-900">{complaint.category ? pickName(complaint.category as any, locale) : '—'}</dd>
                </div>
              </div>
              {complaint.department && (
                <div className="flex items-start gap-3">
                  <Building className="mt-0.5 h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="font-medium text-gray-500">{t('common.department')}</dt>
                    <dd className="text-gray-900">{pickName(complaint.department as any, locale)}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <UserIcon className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <dt className="font-medium text-gray-500">Created By</dt>
                  <dd className="text-gray-900">{getFullName(complaint.createdBy)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <dt className="font-medium text-gray-500">Created</dt>
                  <dd className="text-gray-900">{formatDate(complaint.createdAt, 'MMM d, yyyy HH:mm')}</dd>
                </div>
              </div>
              {(complaint.address || complaint.latitude) && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="font-medium text-gray-500">Location</dt>
                    {complaint.address && (
                      <dd className="text-gray-900">{complaint.address}</dd>
                    )}
                    {complaint.latitude && complaint.longitude && (
                      <dd className="mt-0.5 font-mono text-xs text-gray-500">
                        {Number(complaint.latitude).toFixed(6)}, {Number(complaint.longitude).toFixed(6)}
                      </dd>
                    )}
                  </div>
                </div>
              )}
            </dl>
          </div>

          {/* Map */}
          {complaint.latitude && complaint.longitude && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                <MapPin className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-semibold text-gray-900">Location on Map</h2>
              </div>
              <iframe
                title="Complaint Location"
                width="100%"
                height="280"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(complaint.longitude) - 0.005}%2C${Number(complaint.latitude) - 0.003}%2C${Number(complaint.longitude) + 0.005}%2C${Number(complaint.latitude) + 0.003}&layer=mapnik&marker=${Number(complaint.latitude)}%2C${Number(complaint.longitude)}`}
              />
              <a
                href={`https://www.openstreetmap.org/?mlat=${Number(complaint.latitude)}&mlon=${Number(complaint.longitude)}#map=16/${Number(complaint.latitude)}/${Number(complaint.longitude)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 border-t border-gray-100 py-2 text-xs font-medium text-brand-600 hover:bg-brand-50"
              >
                <MapPin className="h-3.5 w-3.5" />
                View larger map
              </a>
            </div>
          )}

          {/* Current Assignment.
              The backend strips identifiable fields (assignedTo, assignedBy,
              notes) from citizen-facing responses; we only render the panel
              when those fields are present (i.e. for staff). */}
          {activeAssignment && (activeAssignment as any).assignedTo && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Current Assignment</h2>
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">{getFullName((activeAssignment as any).assignedTo)}</p>
                {(activeAssignment as any).notes && (
                  <p className="text-xs text-gray-500">{(activeAssignment as any).notes}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  by {getFullName((activeAssignment as any).assignedBy)} &middot;{' '}
                  {formatDate((activeAssignment as any).createdAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAssignModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-semibold">Assign Complaint</h3>
            <p className="mb-4 text-xs text-gray-500">
              Sorted by current workload (lightest first). Only members of this complaint&apos;s
              department are listed.
            </p>
            <div className="space-y-4">
              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
                {!assignableUsers ? (
                  <div className="py-6 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : assignableUsers.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    No eligible staff in this department.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {assignableUsers.map((u) => {
                      const isPicked = assignUserId === u.id;
                      const heavy = u.activeAssignments >= 5;
                      return (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => setAssignUserId(u.id)}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 ${
                              isPicked ? 'bg-brand-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                isPicked ? 'bg-brand-200 text-brand-800' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-gray-900">
                                  {u.firstName} {u.lastName}
                                </div>
                                <div className="truncate text-xs text-gray-500">
                                  {u.email}
                                  {u.roles.length > 0 && (
                                    <span className="ml-1 text-gray-400">
                                      · {u.roles.join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                heavy
                                  ? 'bg-red-100 text-red-700'
                                  : u.activeAssignments === 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                              title={`${u.activeAssignments} active complaint${u.activeAssignments === 1 ? '' : 's'} assigned`}
                            >
                              {u.activeAssignments} active
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</label>
                <textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAssignModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => assignMutation.mutate()} disabled={!assignUserId || assignMutation.isPending}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return for more work (PENDING_APPROVAL review) */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowReturnModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-semibold text-amber-800">{t('complaints.detail.approval.returnTitle')}</h3>
            <p className="mb-4 text-sm text-gray-600">{t('complaints.detail.approval.returnHint')}</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('complaints.detail.approval.returnNotesLabel')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  rows={4}
                  placeholder={t('complaints.detail.approval.returnNotesPlaceholder')}
                />
                {returnNotes.trim().length > 0 && returnNotes.trim().length < 5 && (
                  <p className="mt-1 text-xs text-red-500">{t('complaints.detail.approval.returnNotesRequired')}</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowReturnModal(false); setReturnNotes(''); }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => returnForWorkMutation.mutate()}
                  disabled={returnForWorkMutation.isPending || returnNotes.trim().length < 5}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {returnForWorkMutation.isPending ? t('common.loading') : t('complaints.detail.action.returnForWork')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowStatusModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">Change Status</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">New Status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {Object.values(ComplaintStatus).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</label>
                <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowStatusModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {statusMutation.isPending ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Priority Modal */}
      {showPriorityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPriorityModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">Set Priority</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Priority Level</label>
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as ComplaintPriority)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {Object.values(ComplaintPriority).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Due Date (optional)</label>
                <input type="datetime-local" value={priorityDueDate} onChange={(e) => setPriorityDueDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">Leave empty to use the default SLA based on priority.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowPriorityModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => priorityMutation.mutate()} disabled={priorityMutation.isPending}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {priorityMutation.isPending ? 'Updating...' : 'Update Priority'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRejectModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-red-700">Reject Complaint</h3>
            <p className="mb-4 text-sm text-gray-600">
              This will mark the complaint as rejected and notify the citizen.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rejection Reason</label>
                <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value as RejectionReason)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                >
                  <option value={RejectionReason.DUPLICATE}>Duplicate</option>
                  <option value={RejectionReason.INVALID_CATEGORY}>Invalid Category</option>
                  <option value={RejectionReason.INSUFFICIENT_INFO}>Insufficient Information</option>
                  <option value={RejectionReason.OUT_OF_JURISDICTION}>Out of Jurisdiction</option>
                  <option value={RejectionReason.NOT_MUNICIPAL_ISSUE}>Not a Municipal Issue</option>
                  <option value={RejectionReason.ALREADY_RESOLVED}>Already Resolved</option>
                  <option value={RejectionReason.OTHER}>Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Additional Notes (optional)</label>
                <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                  rows={3}
                  placeholder="Provide more details to the citizen..." />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRejectModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject Complaint'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer history (read-only timeline) — reuses the same query the
          action buttons already use to decide visibility, so we don't fire
          a second request just to render the timeline strip. */}
      {transferHistory.length > 0 && <TransferTimeline transfers={transferHistory} />}

      {/* Transfer modal */}
      {showTransferModal && complaint.department?.id && (
        <TransferModal
          targetType="COMPLAINT"
          targetId={complaint.id}
          targetTitle={complaint.title}
          fromDepartmentId={complaint.department.id}
          fromDepartmentName={complaint.department.name}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['complaint', complaint.id] })}
        />
      )}

      {/* Help-request modal */}
      {showHelpModal && complaint.department?.id && (
        <RequestHelpModal
          complaintId={complaint.id}
          complaintTitle={complaint.title}
          fromDepartmentId={complaint.department.id}
          fromDepartmentName={complaint.department.name}
          onClose={() => setShowHelpModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['help-requests', 'complaint', complaint.id] });
            queryClient.invalidateQueries({ queryKey: ['complaint', complaint.id] });
          }}
        />
      )}
    </div>
  );
}
