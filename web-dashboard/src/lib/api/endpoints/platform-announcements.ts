import { get, getPaginated, post, patch } from '../client';
import type {
  PlatformAnnouncement,
  CreatePlatformAnnouncementRequest,
  UpdatePlatformAnnouncementRequest,
  PlatformAnnouncementQueryParams,
} from '@shared/types/platform-announcement';

function qs(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const platformAnnouncementsApi = {
  listPublic: (params?: { page?: number; limit?: number; search?: string }) =>
    getPaginated<PlatformAnnouncement>(
      `/platform/announcements/public${qs(params)}`,
      { skipAuth: true },
    ),

  getPublic: (id: string) =>
    get<PlatformAnnouncement>(`/platform/announcements/public/${id}`, { skipAuth: true }),

  listAdmin: (params?: PlatformAnnouncementQueryParams) =>
    getPaginated<PlatformAnnouncement>(
      `/platform/announcements${qs(params as Record<string, string | number | boolean | undefined>)}`,
    ),

  getAdmin: (id: string) =>
    get<PlatformAnnouncement>(`/platform/announcements/${id}`),

  create: (body: CreatePlatformAnnouncementRequest) =>
    post<PlatformAnnouncement>('/platform/announcements', body),

  update: (id: string, body: UpdatePlatformAnnouncementRequest) =>
    patch<PlatformAnnouncement>(`/platform/announcements/${id}`, body),

  publish: (id: string) =>
    post<PlatformAnnouncement>(`/platform/announcements/${id}/publish`, {}),

  unpublish: (id: string) =>
    post<PlatformAnnouncement>(`/platform/announcements/${id}/unpublish`, {}),

  archive: (id: string) =>
    post<PlatformAnnouncement>(`/platform/announcements/${id}/archive`, {}),

  uploadImage: async (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    const token =
      typeof window !== 'undefined'
        ? (await import('@/lib/auth/store')).useAuthStore.getState().accessToken
        : null;
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    const res = await fetch(`${API_URL}/platform/announcements/${id}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message || 'Upload failed');
    }
    return (json.data ?? json) as PlatformAnnouncement;
  },
};
