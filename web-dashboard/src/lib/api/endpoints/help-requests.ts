import { get, post, del, getPaginated } from '../client';
import { buildQueryString } from '@/lib/utils';
import type {
  HelpRequest,
  HelpRequestDetail,
  CreateHelpRequest,
  RespondHelpRequest,
  AssignHelpRequest,
  SubmitHelpRequest,
  CloseHelpRequest,
  HelpRequestQueryParams,
  HelpPendingCounts,
} from '@shared/types/help-request';

export const helpRequestsApi = {
  list: (params: HelpRequestQueryParams = {}) =>
    getPaginated<HelpRequest>(
      `/help-requests${buildQueryString(params as Record<string, unknown>)}`,
    ),

  pendingCount: () => get<HelpPendingCounts>('/help-requests/pending-count'),

  getById: (id: string) => get<HelpRequestDetail>(`/help-requests/${id}`),

  historyForComplaint: (complaintId: string) =>
    get<HelpRequest[]>(`/help-requests/complaint/${complaintId}`),

  create: (complaintId: string, data: CreateHelpRequest) =>
    post<HelpRequest>(`/help-requests/complaint/${complaintId}`, data),

  approveSource: (id: string, data: RespondHelpRequest) =>
    post<HelpRequest>(`/help-requests/${id}/approve-source`, data),
  rejectSource: (id: string, data: RespondHelpRequest) =>
    post<HelpRequest>(`/help-requests/${id}/reject-source`, data),
  accept:  (id: string, data: RespondHelpRequest) =>
    post<HelpRequest>(`/help-requests/${id}/accept`, data),
  decline: (id: string, data: RespondHelpRequest) =>
    post<HelpRequest>(`/help-requests/${id}/decline`, data),
  assign:  (id: string, data: AssignHelpRequest) =>
    post<HelpRequest>(`/help-requests/${id}/assign`, data),
  submit:  (id: string, data: SubmitHelpRequest) =>
    post<HelpRequest>(`/help-requests/${id}/submit`, data),
  approve: (id: string, data: CloseHelpRequest) =>
    post<HelpRequest>(`/help-requests/${id}/approve`, data),
  reject:  (id: string, data: CloseHelpRequest) =>
    post<HelpRequest>(`/help-requests/${id}/reject`, data),
  cancel:  (id: string) => del<HelpRequest>(`/help-requests/${id}`),
};
