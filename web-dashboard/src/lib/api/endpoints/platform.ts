import { get, post, patch, del, put, postFormData } from '../client';

export interface PlatformBranding {
  id: string;
  logoUrl: string | null;
  bannerImageUrl: string | null;
  bannerOverlayColor: string | null;
  bannerOverlayOpacity: number | null;
  platformName: string | null;
  platformNameAr: string | null;
  platformNameFr: string | null;
  platformDescription: string | null;
  platformDescriptionAr: string | null;
  platformDescriptionFr: string | null;
  operatorName: string | null;
  operatorNameAr: string | null;
  operatorNameFr: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWhatsApp: string | null;
  officeAddress: string | null;
  officeAddressAr: string | null;
  officeAddressFr: string | null;
  openingHours: string | null;
  openingHoursAr: string | null;
  openingHoursFr: string | null;
  appStoreUrl: string | null;
  googlePlayUrl: string | null;
  apkUrl: string | null;
  updatedAt: string;
}

export type UpdatePlatformBrandingRequest = Partial<Omit<PlatformBranding, 'id' | 'updatedAt'>>;

export interface PlatformMunicipality {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  adminUserId?: string | null;
  admin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    isActive: boolean;
  } | null;
  _count?: {
    users: number;
    departments: number;
    complaints: number;
    newsPosts?: number;
  };
}

export interface CreateMunicipalityRequest {
  name: string;
  code: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  verificationStatus: string;
  createdAt: string;
  municipality: { id: string; name: string; code: string } | null;
  department: { id: string; name: string } | null;
  roles: string[];
}

export interface PlatformStats {
  municipalities: { total: number; active: number };
  users: { total: number; active: number };
  complaints: {
    total: number;
    byStatus: { status: string; count: number }[];
    byMunicipality: { municipalityId: string; municipalityName: string; count: number }[];
  };
  kyc: { pending: number };
  recentMunicipalities: PlatformMunicipality[];
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  municipalityId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: any;
  createdAt: string;
}

export const platformApi = {
  // Municipalities
  // Note: backend returns { data: [...] } but client auto-unwraps to PlatformMunicipality[]
  listMunicipalities: (includeInactive = false) =>
    get<PlatformMunicipality[]>(
      `/platform/municipalities${includeInactive ? '?includeInactive=true' : ''}`,
    ),
  getMunicipality: (id: string) => get<PlatformMunicipality>(`/platform/municipalities/${id}`),
  createMunicipality: (data: CreateMunicipalityRequest) =>
    post<{ municipality: PlatformMunicipality; admin: PlatformUser }>(
      '/platform/municipalities',
      data,
    ),
  updateMunicipality: (id: string, data: Partial<{ name: string; isActive: boolean }>) =>
    patch<PlatformMunicipality>(`/platform/municipalities/${id}`, data),

  // Users
  listUsers: (params: {
    page?: number;
    limit?: number;
    search?: string;
    municipalityId?: string;
    isActive?: boolean;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.municipalityId) qs.set('municipalityId', params.municipalityId);
    if (params.isActive !== undefined) qs.set('isActive', String(params.isActive));
    return get<{ items: PlatformUser[]; meta: any }>(`/platform/users?${qs.toString()}`);
  },
  setUserActive: (id: string, isActive: boolean) =>
    patch<{ id: string; isActive: boolean }>(`/platform/users/${id}/active`, { isActive }),
  impersonate: (id: string) =>
    post<{ accessToken: string; expiresIn: number; target: any }>(
      `/platform/users/${id}/impersonate`,
    ),
  // Administrative: reset password / 2fa / force logout / delete
  resetUserPassword: (id: string, newPassword: string) =>
    post<{ ok: true }>(`/platform/users/${id}/reset-password`, { newPassword }),
  resetUser2FA: (id: string) =>
    post<{ ok: true }>(`/platform/users/${id}/reset-2fa`),
  forceLogout: (id: string) =>
    post<{ ok: true; sessionsRevoked: number }>(`/platform/users/${id}/force-logout`),
  deleteUser: (id: string) =>
    del<{ ok: true }>(`/platform/users/${id}`),
  transferMunicipalityAdmin: (
    municipalityId: string,
    target: { newAdminUserId?: string; newAdminEmail?: string },
    revokePrevious = false,
  ) =>
    post<{ ok: true; newAdminEmail: string }>(
      `/platform/municipalities/${municipalityId}/transfer-admin`,
      { ...target, revokePrevious },
    ),
  vacateMunicipalityAdmin: (municipalityId: string) =>
    del<{ ok: true; alreadyVacant?: boolean }>(
      `/platform/municipalities/${municipalityId}/admin`,
    ),

  // Maintenance / settings
  getMaintenance: () =>
    get<{ enabled: boolean; message: string }>('/platform/maintenance'),
  setMaintenance: (data: { enabled: boolean; message?: string }) =>
    put<{ enabled: boolean; message: string }>('/platform/maintenance', data),

  // Platform-wide "Require 2FA for staff" flag
  getRequire2fa: () =>
    get<{ enabled: boolean }>('/platform/require-2fa'),
  setRequire2fa: (enabled: boolean) =>
    put<{ enabled: boolean }>('/platform/require-2fa', { enabled }),

  // Platform-wide "Require email verification before login" flag
  getRequireEmailVerification: () =>
    get<{ enabled: boolean }>('/platform/require-email-verification'),
  setRequireEmailVerification: (enabled: boolean) =>
    put<{ enabled: boolean }>('/platform/require-email-verification', { enabled }),

  // Stats
  getStats: () => get<PlatformStats>('/platform/stats'),

  // Audit
  queryAudit: (params: {
    page?: number;
    limit?: number;
    actorId?: string;
    municipalityId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    from?: string;
    to?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return get<{ items: AuditLogEntry[]; meta: any }>(`/platform/audit?${qs.toString()}`);
  },

  // Platform branding (GET is public, PUT/POST is super admin)
  getBranding: () => get<PlatformBranding>('/platform/branding', { skipAuth: true }),
  updateBranding: (data: UpdatePlatformBrandingRequest) =>
    put<PlatformBranding>('/platform/branding', data),
  uploadBrandingLogo: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return postFormData<PlatformBranding>('/platform/branding/logo', fd);
  },
  uploadBrandingBanner: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return postFormData<PlatformBranding>('/platform/branding/banner', fd);
  },
};
