export type PlatformBroadcastAudience =
  | 'ALL_USERS'
  | 'CITIZENS'
  | 'STAFF'
  | 'MUNICIPALITIES'
  | 'ROLES'
  | 'USERS';

export type PlatformBroadcastChannel = 'IN_APP' | 'PUSH' | 'BOTH';

export type PlatformBroadcastStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';

export interface PlatformBroadcastAudienceConfig {
  municipalityIds?: string[];
  roleIds?: string[];
  userIds?: string[];
}

export interface PlatformBroadcast {
  id: string;
  title: string;
  body: string;
  deepLink?: string | null;
  audience: PlatformBroadcastAudience;
  audienceConfig?: PlatformBroadcastAudienceConfig | null;
  channels: PlatformBroadcastChannel;
  status: PlatformBroadcastStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  recipientCount?: number | null;
  failureReason?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface PlatformBroadcastPreviewResult {
  recipientCount: number;
  audience: PlatformBroadcastAudience;
  audienceConfig?: PlatformBroadcastAudienceConfig | null;
}
