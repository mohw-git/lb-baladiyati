// ============================================================
// Shared API response types — mirrors backend DTOs exactly
// ============================================================

/** Standard success response wrapper */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Standard error response wrapper */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    /** Free-form structured context (e.g. `{ email }` on EMAIL_NOT_VERIFIED). */
    meta?: Record<string, unknown>;
  };
  timestamp: string;
  path?: string;
}

export interface ErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'TOO_MANY_REQUESTS'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID';

/** Paginated list result after unwrapping */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
