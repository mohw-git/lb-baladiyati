// ============================================================
// Auth types — matches backend auth DTOs
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  municipalityCode: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  municipalityId: string | null;
  phone?: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
  avatarUrl?: string | null;
  verificationStatus?: string;
  /**
   * ISO timestamp when the user clicked the email-verification link.
   * `null` means the email is still unverified — the dashboard renders a
   * persistent banner with a Resend button in that case.
   */
  emailVerifiedAt?: string | null;
  /** Convenience boolean derived from `emailVerifiedAt`. */
  emailVerified?: boolean;
  /** Backend-stored language preference: EN | AR | FR (uppercase Prisma enum). */
  locale?: 'EN' | 'AR' | 'FR';
}

export type AccountType = 'CITIZEN' | 'STAFF';

export interface AuthUserWithRoles extends AuthUser {
  /** Set by the API so clients can render citizen vs staff UI without inferring roles. */
  accountType?: AccountType;
  mustChangePassword?: boolean;
  mustEnrollTwoFactor?: boolean;
  roles?: string[];
  /** Same as `roles` but with the Arabic/French translations when provided. */
  rolesDetailed?: {
    id: string;
    name: string;
    nameAr: string | null;
    nameFr: string | null;
  }[];
  permissions?: string[];
  municipality?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameFr?: string | null;
    code: string;
  };
  department?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameFr?: string | null;
  } | null;
  twoFactorEnabled?: boolean;
  /** Active second factor: TOTP (authenticator) or EMAIL (OTP by email). */
  twoFactorMethod?: 'TOTP' | 'EMAIL' | null;
  /** Discord-style hierarchy rank: max priority across the user's roles. */
  effectiveRank?: number;
}

export interface LoginResponse {
  user: AuthUserWithRoles;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  locale?: 'EN' | 'AR' | 'FR';
}
