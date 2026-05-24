import { get, post, del, getPaginated } from '../client';
import { buildQueryString } from '@/lib/utils';
import type {
  TransferRequest,
  CreateTransferRequest,
  AcceptTransferRequest,
  RejectTransferRequest,
  TransferQueryParams,
} from '@shared/types/transfer';

export const transfersApi = {
  list: (params: TransferQueryParams = {}) =>
    getPaginated<TransferRequest>(
      `/transfers${buildQueryString(params as Record<string, unknown>)}`,
    ),

  pendingCount: () => get<{ count: number }>('/transfers/pending-count'),

  getById: (id: string) => get<TransferRequest>(`/transfers/${id}`),

  create: (data: CreateTransferRequest) =>
    post<TransferRequest>('/transfers', data),

  accept: (id: string, data: AcceptTransferRequest) =>
    post<TransferRequest>(`/transfers/${id}/accept`, data),

  reject: (id: string, data: RejectTransferRequest) =>
    post<TransferRequest>(`/transfers/${id}/reject`, data),

  cancel: (id: string) => del<{ ok: true }>(`/transfers/${id}`),
};
