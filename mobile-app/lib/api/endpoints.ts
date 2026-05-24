import { get, post, patch, del, postFormData, getPaginated } from './client';

function qs(params: Record<string, any>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      s.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
  }
  const r = s.toString();
  return r ? `?${r}` : '';
}

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) =>
    post<any>('/auth/login', data, { skipAuth: true }),
  register: (data: { municipalityCode: string; email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    post<any>('/auth/register', data, { skipAuth: true }),
  refresh: (refreshToken: string) =>
    post<any>('/auth/refresh', { refreshToken }, { skipAuth: true }),
  twoFactorLogin: (data: { challengeToken: string; code: string }) =>
    post<any>('/auth/2fa/login', data, { skipAuth: true }),
  getProfile: () => get<any>('/auth/me'),
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    locale?: 'EN' | 'AR' | 'FR';
  }) => patch<any>('/auth/me', data),
  logout: (refreshToken: string) =>
    post<any>('/auth/logout', { refreshToken }),
  logoutAll: () => post<any>('/auth/logout-all'),
};

// Municipalities
export const municipalitiesApi = {
  list: () => get<any[]>('/municipalities', { skipAuth: true }),
};

// Complaints
export const complaintsApi = {
  list: (params: any = {}) => getPaginated<any>(`/complaints${qs(params)}`),
  getById: (id: string) => get<any>(`/complaints/${id}`),
  /**
   * Always submits as multipart/form-data since the backend uses FilesInterceptor.
   * Photos are optional.
   */
  create: (data: any, photos?: { uri: string; name: string; type: string }[]) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('categoryId', data.categoryId);
    if (data.latitude !== undefined && data.latitude !== null) formData.append('latitude', String(data.latitude));
    if (data.longitude !== undefined && data.longitude !== null) formData.append('longitude', String(data.longitude));
    if (data.address) formData.append('address', data.address);
    if (photos && photos.length > 0) {
      photos.forEach((photo) => {
        formData.append('attachments', {
          uri: photo.uri,
          name: photo.name,
          type: photo.type,
        } as any);
      });
    }
    return postFormData<any>('/complaints', formData);
  },
  /** @deprecated use create(data, photos) instead */
  createWithPhotos: (data: any, photos: { uri: string; name: string; type: string }[]) => {
    return complaintsApi.create(data, photos);
  },
  uploadAttachments: (id: string, files: { uri: string; name: string; type: string }[], stage: 'SUBMISSION' | 'PROOF' = 'SUBMISSION') => {
    const formData = new FormData();
    formData.append('stage', stage);
    files.forEach((f) => {
      formData.append('attachments', {
        uri: f.uri,
        name: f.name,
        type: f.type,
      } as any);
    });
    return postFormData<any>(`/complaints/${id}/attachments`, formData);
  },
  /** Change complaint status (for workers/supervisors) */
  changeStatus: (id: string, formData: FormData) => {
    return postFormData<any>(`/complaints/${id}/status`, formData);
  },
  /** Submit feedback after complaint is completed */
  submitFeedback: (id: string, data: { rating: number; comment?: string }) =>
    post<any>(`/complaints/${id}/feedback`, data),
  /** Get complaint statistics */
  getStats: () => get<any>('/complaints/stats/summary'),
  remove: (id: string) => del<any>(`/complaints/${id}`),
};

// Categories
export const categoriesApi = {
  list: () => get<any[]>('/categories'),
};

// News
export const newsApi = {
  list: (params: any = {}) => getPaginated<any>(`/news${qs(params)}`),
  getById: (id: string) => get<any>(`/news/${id}`),
};

// Notifications
export const notificationsApi = {
  list: (params: any = {}) => getPaginated<any>(`/notifications${qs(params)}`),
  unreadCount: () => get<any>('/notifications/unread-count'),
  markRead: (id: string) => patch<any>(`/notifications/${id}/read`),
  markAllRead: () => post<any>('/notifications/read-all'),
};

// Device tokens (FCM)
export const deviceTokensApi = {
  register: (token: string, platform: 'ANDROID' | 'IOS' | 'WEB') =>
    post<any>('/device-tokens', { token, platform }),
  remove: (token: string) => del<any>(`/device-tokens/${token}`),
};

// Departments (for help-request modal pickers)
export const departmentsApi = {
  list: () => get<any[]>('/departments'),
};

// Help Requests (cross-department collaboration without ownership transfer)
export const helpRequestsApi = {
  list: (params: any = {}) => getPaginated<any>(`/help-requests${qs(params)}`),
  getById: (id: string) => get<any>(`/help-requests/${id}`),
  pendingCount: () => get<{ count: number }>('/help-requests/pending-count'),
  historyForComplaint: (complaintId: string) =>
    get<any[]>(`/help-requests/complaint/${complaintId}`),
  create: (complaintId: string, data: { toDepartmentId: string; reason: string }) =>
    post<any>(`/help-requests/complaint/${complaintId}`, data),
  cancel: (id: string) => del<any>(`/help-requests/${id}`),
  accept: (id: string, data: { reason?: string } = {}) =>
    post<any>(`/help-requests/${id}/accept`, data),
  decline: (id: string, data: { reason: string }) =>
    post<any>(`/help-requests/${id}/decline`, data),
  assign: (id: string, data: { assigneeId: string; note?: string }) =>
    post<any>(`/help-requests/${id}/assign`, data),
  submit: (id: string, data: { notes: string; attachments?: any[] }) =>
    post<any>(`/help-requests/${id}/submit`, data),
  approve: (id: string, data: { reason?: string } = {}) =>
    post<any>(`/help-requests/${id}/approve`, data),
  reject: (id: string, data: { reason: string }) =>
    post<any>(`/help-requests/${id}/reject`, data),
};

// Cross-department transfers (full ownership handoff)
export const transfersApi = {
  list: (params: any = {}) => getPaginated<any>(`/transfers${qs(params)}`),
  getById: (id: string) => get<any>(`/transfers/${id}`),
  pendingCount: () => get<{ count: number }>('/transfers/pending-count'),
  accept: (id: string, data: { newAssigneeId: string; note?: string }) =>
    post<any>(`/transfers/${id}/accept`, data),
  reject: (id: string, data: { reason: string }) =>
    post<any>(`/transfers/${id}/reject`, data),
  cancel: (id: string) => del<any>(`/transfers/${id}`),
};

// KYC (Identity Verification)
export const kycApi = {
  getStatus: () => get<any>('/kyc/me'),
  submit: (photos: { idFront: { uri: string; name: string; type: string }; idBack: { uri: string; name: string; type: string }; selfie: { uri: string; name: string; type: string } }) => {
    const formData = new FormData();
    formData.append('idFront', photos.idFront as any);
    formData.append('idBack', photos.idBack as any);
    formData.append('selfie', photos.selfie as any);
    return postFormData<any>('/kyc/submit', formData);
  },
};
