import { get, post, patch, del, put, postFormData } from '../client';

export interface PlatformBranding {
  id: string;
  logoUrl: string | null;
  bannerImageUrl: string | null;
  bannerOverlayColor: string | null;
  bannerOverlayOpacity: number | null;
  bannerFocalX: number | null;
  bannerFocalY: number | null;
  authBackgroundImageUrl: string | null;
  authBackgroundFocalX: number | null;
  authBackgroundFocalY: number | null;
  authBackgroundOverlayOpacity: number | null;
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
  /** Android APK direct download URL (Super Admin → Platform Branding). */
  apkUrl: string | null;
  updatedAt: string;
}

export type UpdatePlatformBrandingRequest = Partial<Omit<PlatformBranding, 'id' | 'updatedAt'>>;

export type MunicipalityBoundarySourceType = 'AUTO_FROM_SOURCE' | 'MANUAL_GEOJSON';

export interface MunicipalityBoundaryInfo {
  municipalityId: string;
  configured: boolean;
  isActive: boolean;
  bufferMeters: number;
  updatedAt: string | null;
  geojson: { type: string; coordinates: unknown } | null;
  bounds: [number, number, number, number] | null;
  sourceType?: MunicipalityBoundarySourceType | null;
  sourceImportId?: string | null;
  lastGeneratedAt?: string | null;
  assignedFeatureCount?: number;
  overlaps?: BoundaryOverlapInfo[];
}

export interface BoundarySourceImportInfo {
  id: string;
  name: string;
  fileName: string;
  validOn: string | null;
  version: string | null;
  featureCount: number;
  status: 'IMPORTING' | 'ACTIVE' | 'ARCHIVED';
  importedAt: string;
}

export interface BoundaryAssignmentWorkspace {
  activeImport: BoundarySourceImportInfo | null;
  pendingImport: BoundarySourceImportInfo | null;
  municipalities: Array<{
    id: string;
    name: string;
    nameAr?: string | null;
    nameFr?: string | null;
    code: string;
    boundaryColor: string | null;
    configured: boolean;
    sourceType: MunicipalityBoundarySourceType | null;
    sourceImportId: string | null;
    lastGeneratedAt: string | null;
    assignedFeatureCount: number;
  }>;
  assignments: Array<{
    id: string;
    featureId: string;
    municipalityId: string;
    featureKey: string;
    adm3Name: string;
    adm3Pcode: string;
  }>;
  boundaries: Array<{
    municipalityId: string;
    name: string;
    code: string;
    sourceType: MunicipalityBoundarySourceType;
    geojson: { type: string; coordinates: unknown };
    bounds: [number, number, number, number];
  }>;
  stats: {
    configured: number;
    missing: number;
    unassignedFeatureCount: number;
    conflictCount: number;
  };
}

export interface BoundaryOverlapInfo {
  municipalityId: string;
  name: string;
  code: string;
}

export interface MunicipalityBoundaryMapItem {
  municipalityId: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  code: string;
  isActive: boolean;
  geojson: { type: string; coordinates: unknown };
  bounds: [number, number, number, number];
}

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
    complaintCategories?: number;
    complaints: number;
    newsPosts?: number;
  };
}

export type MunicipalityStarterTemplate =
  | 'FULL_GOVERNMENT'
  | 'DEPARTMENTS_ONLY'
  | 'BLANK';

export interface CreateMunicipalityRequest {
  name: string;
  nameAr?: string;
  nameFr?: string;
  code: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  starterTemplate?: MunicipalityStarterTemplate;
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
  emailVerifiedAt: string | null;
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
  applyStarterCategories: (municipalityId: string) =>
    post<{ municipality: PlatformMunicipality }>(
      `/platform/municipalities/${municipalityId}/apply-starter-categories`,
      {},
    ),
  updateMunicipality: (id: string, data: Partial<{ name: string; isActive: boolean }>) =>
    patch<PlatformMunicipality>(`/platform/municipalities/${id}`, data),

  listMunicipalityBoundaries: (includeInactive = false) =>
    get<MunicipalityBoundaryMapItem[]>(
      `/platform/municipalities/boundaries${includeInactive ? '?includeInactive=true' : ''}`,
    ),

  getMunicipalityBoundary: (municipalityId: string) =>
    get<MunicipalityBoundaryInfo>(`/platform/municipalities/${municipalityId}/boundary`),

  validateMunicipalityBoundary: (
    municipalityId: string,
    body: { geojson: unknown; bufferMeters?: number },
  ) =>
    post<{
      valid: boolean;
      geojson: { type: string; coordinates: unknown };
      bufferMeters: number;
      bounds: [number, number, number, number];
      overlaps: BoundaryOverlapInfo[];
    }>(`/platform/municipalities/${municipalityId}/boundary/validate`, body),

  upsertMunicipalityBoundary: (
    municipalityId: string,
    body: { geojson: unknown; bufferMeters?: number; isActive?: boolean },
  ) =>
    put<MunicipalityBoundaryInfo>(`/platform/municipalities/${municipalityId}/boundary`, body),

  deactivateMunicipalityBoundary: (municipalityId: string) =>
    del<MunicipalityBoundaryInfo>(`/platform/municipalities/${municipalityId}/boundary`),

  getBoundaryAssignmentWorkspace: () =>
    get<BoundaryAssignmentWorkspace>('/platform/boundary-assignment/workspace'),

  getActiveBoundarySourceFeatures: () =>
    get<{
      import: BoundarySourceImportInfo;
      featureCollection: GeoJSON.FeatureCollection;
    } | null>('/platform/boundary-source-imports/active/features'),

  createBoundarySourceImport: (body: {
    fileName: string;
    name?: string;
    validOn?: string;
    version?: string;
  }) => post<BoundarySourceImportInfo>('/platform/boundary-source-imports', body),

  addBoundarySourceFeatures: (
    importId: string,
    body: {
      features: Array<{
        featureKey: string;
        adm3Name: string;
        adm3Name1?: string;
        adm3Pcode: string;
        adm2Name: string;
        adm1Name: string;
        areaSqkm?: number;
        centerLat?: number;
        centerLon?: number;
        geometry: unknown;
      }>;
    },
  ) =>
    post<{ accepted: number; skippedInvalid: number; featureCount: number }>(
      `/platform/boundary-source-imports/${importId}/features`,
      body,
    ),

  activateBoundarySourceImport: (importId: string) =>
    post<BoundarySourceImportInfo>(`/platform/boundary-source-imports/${importId}/activate`, {}),

  cancelBoundarySourceImport: (importId: string) =>
    del<{ cancelled: boolean; importId: string }>(`/platform/boundary-source-imports/${importId}`),

  importDefaultBoundarySource: (replace = false) =>
    post<{
      importId: string;
      status: string;
      featureCount: number;
      inserted: number;
      invalidGeometryCount: number;
      skippedCount: number;
      replacedPrevious: boolean;
    }>(
      `/platform/boundary-source-imports/import-default${replace ? '?replace=true' : ''}`,
      {},
    ),

  updateBoundaryAssignments: (body: {
    municipalityId: string;
    mode: 'assign' | 'unassign';
    featureIds: string[];
    switchToSourceBased?: boolean;
    forceReassign?: boolean;
    confirmOverlap?: boolean;
  }) => put<unknown>('/platform/boundary-assignments', body),

  clearMunicipalityBoundaryAssignments: (municipalityId: string) =>
    del<{ revoked: number; boundaryDeactivated: boolean }>(
      `/platform/boundary-assignments/municipality/${municipalityId}?confirmed=true`,
    ),

  updateMunicipalityBoundaryColor: (municipalityId: string, boundaryColor: string) =>
    patch<{ id: string; boundaryColor: string }>(
      `/platform/municipalities/${municipalityId}/boundary-color`,
      { boundaryColor },
    ),

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
  verifyUserEmail: (id: string) =>
    post<{ ok: true; alreadyVerified: boolean; emailVerifiedAt: string }>(
      `/platform/users/${id}/verify-email`,
    ),
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

  getAllowUnverifiedCitizenComplaints: () =>
    get<{ enabled: boolean }>('/platform/allow-unverified-citizen-complaints'),
  setAllowUnverifiedCitizenComplaints: (enabled: boolean) =>
    put<{ enabled: boolean }>('/platform/allow-unverified-citizen-complaints', {
      enabled,
    }),

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
  uploadBrandingAuthBackground: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return postFormData<PlatformBranding>('/platform/branding/auth-background', fd);
  },
};
