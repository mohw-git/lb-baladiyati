'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { complaintsApi, transfersApi, ApiError, getFileUrl } from '@/lib/api';
import { TransferModal } from '@/components/transfers/transfer-modal';
import { TransferTimeline } from '@/components/transfers/transfer-timeline';
import { RequestHelpModal } from '@/components/help-requests/request-help-modal';
import { HelpPanel } from '@/components/help-requests/help-panel';
import { usePermission } from '@/lib/auth';
import { PERMISSIONS } from '@shared/constants/permissions';
import { ComplaintStatus, ComplaintPriority, RejectionReason } from '@shared/types/complaint';
import { STATUS_LABELS } from '@shared/constants/status';
import { StatusBadge } from '@/components/features/complaints/status-badge';
import { formatDate, getFullName } from '@/lib/utils';
import {
  ArrowLeft, MapPin, Calendar, User as UserIcon, Tag, Building,
  Paperclip, History, UserPlus, RefreshCw, Loader2, Trash2, Image, Flag, XCircle, Send,
  HandHelping,
} from 'lucide-react';
import { useTranslate, useLocale, isRtl, pickName } from '@/lib/i18n';

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);

  const canAssign = usePermission(PERMISSIONS.COMPLAINT_ASSIGN);
  const canChangeStatus = usePermission(PERMISSIONS.COMPLAINT_CHANGE_STATUS);
  const canSetPriority = usePermission(PERMISSIONS.COMPLAINT_SET_PRIORITY);
  const canReject = usePermission(PERMISSIONS.COMPLAINT_REJECT);
  const canTransfer = usePermission(PERMISSIONS.TRANSFER_REQUEST);
  const canHelpRequest = usePermission(PERMISSIONS.HELP_REQUEST);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
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

  const { data: assignableUsers } = useQuery({
    queryKey: ['complaint', id, 'assignable-users'],
    queryFn: () => complaintsApi.listAssignableUsers(id),
    enabled: showAssignModal,
  });

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
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span className="font-mono">{complaint.referenceCode}</span>
            <StatusBadge status={complaint.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAssign && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="btn-gov-secondary"
            >
              <UserPlus className="h-4 w-4" /> {t('complaints.detail.action.assign')}
            </button>
          )}
          {canHelpRequest && complaint.department?.id && (
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              <HandHelping className="h-4 w-4" /> {t('complaints.detail.action.askHelp')}
            </button>
          )}
          {canTransfer && complaint.department?.id && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100"
            >
              <Send className="h-4 w-4" /> {t('complaints.detail.action.transfer')}
            </button>
          )}
          {canSetPriority && (
            <button
              onClick={() => {
                setNewPriority(complaint.priority || ComplaintPriority.MEDIUM);
                setPriorityDueDate(complaint.dueDate ? new Date(complaint.dueDate).toISOString().slice(0, 16) : '');
                setShowPriorityModal(true);
              }}
              className="btn-gov-secondary"
            >
              <Flag className="h-4 w-4" /> {t('common.priority')}
            </button>
          )}
          {canReject && complaint.status !== 'REJECTED' && complaint.status !== 'CLOSED' && (
            <button
              onClick={() => setShowRejectModal(true)}
              className="flex items-center gap-1.5 rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" /> {t('complaints.detail.action.reject')}
            </button>
          )}
          {canChangeStatus && (
            <button
              onClick={() => setShowStatusModal(true)}
              className="btn-gov-primary"
            >
              <RefreshCw className="h-4 w-4" /> {t('common.status')}
            </button>
          )}
          <button
            onClick={() => { if (confirm(t('complaints.detail.deleteConfirm'))) deleteMutation.mutate(); }}
            className="rounded border border-red-200 p-2 text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

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
          {complaint.currentAssignment && (complaint.currentAssignment as any).assignedTo && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Current Assignment</h2>
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">{getFullName((complaint.currentAssignment as any).assignedTo)}</p>
                {(complaint.currentAssignment as any).notes && (
                  <p className="text-xs text-gray-500">{(complaint.currentAssignment as any).notes}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  by {getFullName((complaint.currentAssignment as any).assignedBy)} &middot;{' '}
                  {formatDate((complaint.currentAssignment as any).createdAt)}
                </p>
              </div>
            </div>
          )}
          {/* Legacy: assignments array if present */}
          {!complaint.currentAssignment && (complaint as any).assignments?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Assignments</h2>
              <div className="space-y-2">
                {(complaint as any).assignments.filter((a: any) => a.isActive).map((a: any) => (
                  <div key={a.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="font-medium text-gray-900">{getFullName(a.assignedTo)}</p>
                    {a.notes && <p className="text-xs text-gray-500">{a.notes}</p>}
                    <p className="mt-1 text-xs text-gray-400">
                      by {getFullName(a.assignedBy)} &middot; {formatDate(a.createdAt)}
                    </p>
                  </div>
                ))}
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

      {/* Transfer history (read-only timeline) */}
      <ComplaintTransferHistory complaintId={complaint.id} />

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

// Helper component to fetch + render the transfer timeline for a complaint
function ComplaintTransferHistory({ complaintId }: { complaintId: string }) {
  const { data } = useQuery({
    queryKey: ['complaint', complaintId, 'transfers'],
    queryFn: async () => {
      const res = await transfersApi.list({ targetType: 'COMPLAINT', limit: 100 });
      return res.items.filter((t: any) => t.targetId === complaintId);
    },
  });
  if (!data || data.length === 0) return null;
  return <TransferTimeline transfers={data} />;
}
