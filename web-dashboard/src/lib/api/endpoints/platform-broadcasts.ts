import { get, getPaginated, post } from '../client';
import type {
  PlatformBroadcast,
  PlatformBroadcastPreviewResult,
  PlatformBroadcastAudience,
  PlatformBroadcastChannel,
  PlatformBroadcastStatus,
  PlatformBroadcastAudienceConfig,
} from '@shared/types/platform-broadcast';

function qs(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export type PlatformBroadcastSendRequest = {
  title: string;
  body: string;
  deepLink?: string;
  audience: PlatformBroadcastAudience;
  audienceConfig?: PlatformBroadcastAudienceConfig;
  channels: PlatformBroadcastChannel;
  scheduledAt?: string;
  idempotencyKey?: string;
  confirmPhrase?: string;
};

export type PlatformBroadcastPreviewRequest = Pick<
  PlatformBroadcastSendRequest,
  'title' | 'body' | 'audience' | 'audienceConfig' | 'channels'
>;

export const platformBroadcastsApi = {
  preview: (body: PlatformBroadcastPreviewRequest) =>
    post<PlatformBroadcastPreviewResult>('/platform/notifications/broadcasts/preview', body),

  send: (body: PlatformBroadcastSendRequest) =>
    post<PlatformBroadcast>('/platform/notifications/broadcasts', body),

  list: (params?: { page?: number; limit?: number; status?: PlatformBroadcastStatus }) =>
    getPaginated<PlatformBroadcast>(
      `/platform/notifications/broadcasts${qs(params)}`,
    ),

  get: (id: string) => get<PlatformBroadcast>(`/platform/notifications/broadcasts/${id}`),
};
