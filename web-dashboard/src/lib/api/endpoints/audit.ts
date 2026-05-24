import { get, downloadFile } from '../client';

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  municipalityId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AuditQuery {
  page?: number;
  limit?: number;
  action?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}

function qs(params: AuditQuery): string {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') s.set(k, String(v));
  });
  const r = s.toString();
  return r ? `?${r}` : '';
}

/**
 * Tenant-scoped audit log (caller's municipality only).
 * Super admin cross-tenant view stays on /platform/audit (see platformApi.queryAudit).
 */
export const auditApi = {
  list: (params: AuditQuery = {}) =>
    get<{ items: AuditEntry[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      `/audit${qs(params)}`,
    ),
  exportCsv: (params: Omit<AuditQuery, 'page' | 'limit'> = {}) =>
    downloadFile(`/audit/export.csv${qs(params)}`, 'audit.csv'),
};
