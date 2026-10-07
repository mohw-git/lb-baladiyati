import { get, post, patch, del, postFormData, getPaginated, downloadFile } from '../client';
import { buildQueryString } from '@/lib/utils';
import type {
  ComplaintSummary,
  ComplaintDetail,
  ComplaintQueryParams,
  AssignComplaintRequest,
  ChangeStatusRequest,
  SetPriorityRequest,
  RejectComplaintRequest,
  ClassifyComplaintRequest,
  ClassifyComplaintResponse,
  ComplaintMapPointsResponse,
  ComplaintMapPointsQueryParams,
} from '@shared/types/complaint';
import type { DepartmentWorkloadRow } from '@shared/types/department';

interface ComplaintStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
}

export interface ComplaintBuckets {
  needsAttention: number;
  assignedToMe: number;
  myDepartment: number;
  all: number;
  overdue: number;
  myReports: number;
  completed: number;
  rejected: number;
  closed: number;
  history: number;
}

export interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  roles: string[];
  activeAssignments: number;
}

export interface CreateComplaintRequest {
  categoryId: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
  selectedMunicipalityId?: string;
}

export const complaintsApi = {
  list: (params: ComplaintQueryParams = {}) =>
    getPaginated<ComplaintSummary>(`/complaints${buildQueryString(params as Record<string, unknown>)}`),

  getById: (id: string) =>
    get<ComplaintDetail>(`/complaints/${id}`),

  resolveLocation: (latitude: number, longitude: number) =>
    get<{
      status: string;
      municipalityId: string | null;
      method: string | null;
      candidates: { id: string; name: string; code: string; nameAr?: string; nameFr?: string }[];
      distanceMeters?: number;
    }>(`/complaints/resolve-location?latitude=${latitude}&longitude=${longitude}`),

  create: (data: CreateComplaintRequest, files?: File[]) => {
    const fd = new FormData();
    fd.append('categoryId', data.categoryId);
    fd.append('title', data.title);
    fd.append('description', data.description);
    if (data.latitude !== undefined) fd.append('latitude', String(data.latitude));
    if (data.longitude !== undefined) fd.append('longitude', String(data.longitude));
    if (data.address) fd.append('address', data.address);
    if (data.selectedMunicipalityId) {
      fd.append('selectedMunicipalityId', data.selectedMunicipalityId);
    }
    if (files && files.length) {
      files.forEach((f) => fd.append('attachments', f));
    }
    return postFormData<ComplaintDetail>('/complaints', fd);
  },

  getStats: () =>
    get<ComplaintStats>('/complaints/stats/summary'),

  getBuckets: () =>
    get<ComplaintBuckets>('/complaints/stats/buckets'),

  getDepartmentWorkload: () =>
    get<DepartmentWorkloadRow[]>('/complaints/stats/department-workload'),

  getCharts: () =>
    get<{
      complaintsPerDay: { date: string; count: number }[];
      byCategory: { name: string; count: number }[];
      byPriority: { priority: string; count: number }[];
      avgResolutionHours: number;
    }>('/complaints/stats/charts'),

  getMapPoints: (
    params: ComplaintMapPointsQueryParams = {},
    options?: { signal?: AbortSignal },
  ) =>
    get<ComplaintMapPointsResponse>(
      `/complaints/map-points${buildQueryString(params as Record<string, unknown>)}`,
      options,
    ),

  assign: (id: string, data: AssignComplaintRequest) =>
    post<ComplaintDetail>(`/complaints/${id}/assign`, data),

  listAssignableUsers: (id: string) =>
    get<AssignableUser[]>(`/complaints/${id}/assignable-users`),

  changeStatus: (id: string, data: ChangeStatusRequest, files?: File[]) => {
    const formData = new FormData();
    formData.append('status', data.status);
    if (data.notes) formData.append('notes', data.notes);
    if (files && files.length > 0) {
      files.forEach((file) => formData.append('attachments', file));
    }
    return postFormData<ComplaintDetail>(`/complaints/${id}/status`, formData);
  },

  setPriority: (id: string, data: SetPriorityRequest) =>
    patch<ComplaintDetail>(`/complaints/${id}/priority`, data),

  classify: (id: string, data: ClassifyComplaintRequest) =>
    patch<ClassifyComplaintResponse>(`/complaints/${id}/classification`, data),

  reject: (id: string, data: RejectComplaintRequest) =>
    post<ComplaintDetail>(`/complaints/${id}/reject`, data),

  uploadAttachments: (id: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('attachments', file));
    return postFormData<ComplaintDetail>(`/complaints/${id}/attachments`, formData);
  },

  remove: (id: string) =>
    del<{ message: string }>(`/complaints/${id}`),

  exportCsv: (params: ComplaintQueryParams = {}) =>
    downloadFile(
      `/complaints/export.csv${buildQueryString(params as Record<string, unknown>)}`,
      'complaints.csv',
    ),
};
