import { get, post, postFormData, getPaginated } from '../client';

export interface KycSubmission {
  id: string;
  userId: string;
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  attachments: {
    id: string;
    docType: 'ID_FRONT' | 'ID_BACK' | 'SELFIE';
    mimeType: string;
    size: number;
    createdAt: string;
  }[];
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    verificationStatus?: string;
  };
  reviewLogs?: {
    id: string;
    action: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    reason?: string;
    performedBy: { id: string; firstName: string; lastName: string };
    createdAt: string;
  }[];
}

export const kycApi = {
  list: (params: { page?: number; limit?: number; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status) qs.set('status', params.status);
    const q = qs.toString();
    return getPaginated<KycSubmission>(`/admin/kyc${q ? `?${q}` : ''}`);
  },

  getById: (id: string) =>
    get<KycSubmission>(`/admin/kyc/${id}`),

  review: (id: string, data: { action: 'APPROVE' | 'REJECT'; reason?: string }) =>
    post<KycSubmission>(`/admin/kyc/${id}/review`, data),

  /** Returns the secure attachment URL (requires auth) */
  getAttachmentUrl: (submissionId: string, attachmentId: string) =>
    `/admin/kyc/${submissionId}/attachments/${attachmentId}`,

  /** Get current user's own KYC status (citizen self-service) */
  getMyStatus: () =>
    get<{
      verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
      submittedAt: string | null;
      reviewedAt: string | null;
      rejectionReason: string | null;
      hasActiveSubmission: boolean;
    }>(`/kyc/me`),

  /** Submit KYC documents (citizen self-service from web) */
  submit: (files: { idFront: File; idBack: File; selfie: File }) => {
    const fd = new FormData();
    fd.append('idFront', files.idFront);
    fd.append('idBack', files.idBack);
    fd.append('selfie', files.selfie);
    return postFormData<KycSubmission>(`/kyc/submit`, fd);
  },

  /** Manually verify or un-verify a user without going through document submission */
  manualOverride: (
    userId: string,
    data: { status: 'VERIFIED' | 'UNVERIFIED'; reason: string },
  ) => post<{ userId: string; verificationStatus: string; previousStatus: string }>(
    `/admin/kyc/users/${userId}/manual-override`,
    data,
  ),
};
