import { get, post, patch, postFormData } from '../client';
import type { LoginRequest, LoginResponse, RegisterRequest, RefreshResponse, AuthUserWithRoles, UpdateProfileRequest } from '@shared/types/auth';

export type TwoFactorMethod = 'TOTP' | 'EMAIL';

export interface TwoFactorChallengeResponse {
  twoFactorRequired: true;
  /** Which factor the user is enrolled in. Defaults to TOTP for legacy accounts. */
  twoFactorMethod?: TwoFactorMethod;
  challengeToken: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/** Generic "ok" message returned by enumeration-safe endpoints (forgot, resend). */
export interface MessageResponse {
  message: string;
}

export const authApi = {
  login: (data: LoginRequest) =>
    post<LoginResponse | TwoFactorChallengeResponse>('/auth/login', data, { skipAuth: true }),

  register: (data: RegisterRequest) =>
    post<LoginResponse>('/auth/register', data, { skipAuth: true }),

  refresh: (refreshToken: string) =>
    post<RefreshResponse>('/auth/refresh', { refreshToken }, { skipAuth: true }),

  getProfile: () =>
    get<AuthUserWithRoles>('/auth/me'),

  updateProfile: (data: UpdateProfileRequest) =>
    patch<AuthUserWithRoles>('/auth/me', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    post<{ message: string }>('/auth/change-password', data),

  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return postFormData<{ avatarUrl: string }>('/auth/me/avatar', fd);
  },

  // ───────── TOTP 2FA ─────────
  setupTwoFactor: () =>
    post<TwoFactorSetupResponse>('/auth/2fa/setup'),
  verifyTwoFactor: (code: string) =>
    post<{ enabled: true }>('/auth/2fa/verify', { code }),
  disableTwoFactor: (data: { password: string; code: string }) =>
    post<{ disabled: true }>('/auth/2fa/disable', data),
  twoFactorLogin: (data: { challengeToken: string; code: string }) =>
    post<LoginResponse>('/auth/2fa/login', data, { skipAuth: true }),

  // ───────── Email 2FA ─────────
  enableEmailTwoFactor: (password: string) =>
    post<{ enabled: true; method: 'EMAIL' }>('/auth/2fa/email/enable', { password }),
  emailTwoFactorLogin: (data: { challengeToken: string; code: string }) =>
    post<LoginResponse>('/auth/2fa/email/login', data, { skipAuth: true }),
  resendEmailTwoFactorCode: (challengeToken: string) =>
    post<MessageResponse>('/auth/2fa/email/resend', { challengeToken }, { skipAuth: true }),

  // ───────── Email verification ─────────
  resendVerification: (email: string) =>
    post<MessageResponse>('/auth/resend-verification', { email }, { skipAuth: true }),
  verifyEmail: (token: string) =>
    post<MessageResponse>('/auth/verify-email', { token }, { skipAuth: true }),

  // ───────── Password reset by email ─────────
  forgotPassword: (email: string) =>
    post<MessageResponse>('/auth/forgot-password', { email }, { skipAuth: true }),
  resetPassword: (data: { token: string; newPassword: string }) =>
    post<MessageResponse>('/auth/reset-password', data, { skipAuth: true }),

  logout: (refreshToken: string) =>
    post<{ message: string }>('/auth/logout', { refreshToken }),

  logoutAll: () =>
    post<{ message: string }>('/auth/logout-all'),
};
