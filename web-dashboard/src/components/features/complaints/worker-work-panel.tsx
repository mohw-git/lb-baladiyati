'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Play, Send, Camera, X, Image as ImageIcon } from 'lucide-react';
import { complaintsApi, ApiError } from '@/lib/api';
import { ComplaintStatus } from '@shared/types/complaint';
import { useTranslate, type MessageKey } from '@/lib/i18n';

const MAX_PROOF_FILES = 5;

export function invalidateComplaintWorkQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  complaintId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
  queryClient.invalidateQueries({ queryKey: ['complaints'] });
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
}

interface WorkerWorkPanelProps {
  complaintId: string;
  status: string;
  /** Active assignee user id from currentAssignment */
  assigneeId?: string | null;
  currentUserId?: string;
  canChangeStatus: boolean;
  isPreview?: boolean;
  onActionError?: (err: unknown) => void;
}

export function WorkerWorkPanel({
  complaintId,
  status,
  assigneeId,
  currentUserId,
  canChangeStatus,
  isPreview,
  onActionError,
}: WorkerWorkPanelProps) {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [workNotes, setWorkNotes] = useState('');
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofPreviews, setProofPreviews] = useState<string[]>([]);

  const isActiveAssignee =
    !!currentUserId && !!assigneeId && assigneeId === currentUserId;
  const canDoWorkerWork = canChangeStatus && isActiveAssignee && !isPreview;

  const showStartWork =
    canDoWorkerWork && status === ComplaintStatus.ASSIGNED;
  const showSubmitWork =
    canDoWorkerWork && status === ComplaintStatus.IN_PROGRESS;

  const handleError = (err: unknown) => {
    if (onActionError) {
      onActionError(err);
      return;
    }
    if (err instanceof ApiError) {
      if (err.status === 403) {
        toast.error(t('complaints.worker.notAssigned'));
        return;
      }
      if (err.status === 400 && err.message?.toLowerCase().includes('proof')) {
        toast.error(t('complaints.worker.proofRequired'));
        return;
      }
      if (err.status === 400 && err.message?.toLowerCase().includes('transition')) {
        toast.error(t('complaints.worker.invalidStatus'));
        return;
      }
    }
    toast.error(err instanceof Error ? err.message : t('common.error'));
  };

  const afterWorkerAction = (messageKey: MessageKey) => {
    toast.success(t(messageKey));
    setShowSubmitModal(false);
    setWorkNotes('');
    clearProofFiles();
    invalidateComplaintWorkQueries(queryClient, complaintId);
  };

  const startWorkMutation = useMutation({
    mutationFn: () =>
      complaintsApi.changeStatus(complaintId, {
        status: ComplaintStatus.IN_PROGRESS,
      }),
    onSuccess: () => afterWorkerAction('complaints.worker.startedSuccess'),
    onError: handleError,
  });

  const submitWorkMutation = useMutation({
    mutationFn: () =>
      complaintsApi.changeStatus(
        complaintId,
        {
          status: ComplaintStatus.PENDING_APPROVAL,
          notes: workNotes.trim() || undefined,
        },
        proofFiles,
      ),
    onSuccess: () => afterWorkerAction('complaints.worker.submittedSuccess'),
    onError: handleError,
  });

  const clearProofFiles = () => {
    proofPreviews.forEach((url) => URL.revokeObjectURL(url));
    setProofFiles([]);
    setProofPreviews([]);
  };

  const addProofFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    const images = Array.from(incoming).filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      toast.error(t('complaints.worker.proofImagesOnly'));
      return;
    }
    const merged = [...proofFiles, ...images].slice(0, MAX_PROOF_FILES);
    proofPreviews.forEach((url) => URL.revokeObjectURL(url));
    setProofFiles(merged);
    setProofPreviews(merged.map((f) => URL.createObjectURL(f)));
  };

  const removeProofAt = (index: number) => {
    const next = proofFiles.filter((_, i) => i !== index);
    URL.revokeObjectURL(proofPreviews[index]);
    setProofFiles(next);
    setProofPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const handleStartWork = () => {
    if (
      !window.confirm(
        `${t('complaints.worker.startWork')}\n\n${t('complaints.worker.startWorkConfirm')}`,
      )
    ) {
      return;
    }
    startWorkMutation.mutate();
  };

  const handleSubmitWork = () => {
    if (!proofFiles.length) {
      toast.error(t('complaints.worker.proofRequired'));
      return;
    }
    submitWorkMutation.mutate();
  };

  if (!showStartWork && !showSubmitWork) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showStartWork && (
          <button
            type="button"
            onClick={handleStartWork}
            disabled={startWorkMutation.isPending}
            className="flex items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {startWorkMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t('complaints.worker.startWork')}
          </button>
        )}
        {showSubmitWork && (
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            disabled={submitWorkMutation.isPending}
            className="flex items-center gap-1.5 rounded border border-brand-600 bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {t('complaints.worker.submitForReview')}
          </button>
        )}
      </div>

      {showSubmitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowSubmitModal(false);
            clearProofFiles();
            setWorkNotes('');
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">
              {t('complaints.worker.submitForReview')}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {t('complaints.worker.submitHint')}
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('complaints.worker.workNotes')}
                </label>
                <textarea
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  placeholder={t('complaints.worker.workNotesPlaceholder')}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('complaints.worker.proofAttachments')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  {t('complaints.worker.proofHint', { max: String(MAX_PROOF_FILES) })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {proofPreviews.map((src, i) => (
                    <div
                      key={src}
                      className="relative h-20 w-20 overflow-hidden rounded border border-gray-200"
                    >
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeProofAt(i)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                        aria-label={t('common.delete')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {proofFiles.length < MAX_PROOF_FILES && (
                    <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:border-brand-400 hover:bg-brand-50">
                      <Camera className="h-5 w-5" />
                      <span className="mt-0.5 text-[10px]">{t('common.add')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addProofFiles(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                {proofFiles.length === 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {t('complaints.worker.proofRequired')}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmitModal(false);
                    clearProofFiles();
                    setWorkNotes('');
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitWork}
                  disabled={submitWorkMutation.isPending || proofFiles.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitWorkMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t('complaints.worker.submitWork')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
