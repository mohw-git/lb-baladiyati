import type { ApiResponse, ApiErrorResponse, PaginatedResult, PaginationMeta } from '@shared/types/api';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// ============================================================
// Auth token accessors — reads from Zustand store via getters
// ============================================================
type TokenGetter = () => string | null;
type TokenSetter = (access: string, refresh: string) => void;
type LogoutFn = () => void;

let _getAccessToken: TokenGetter = () => null;
let _getRefreshToken: TokenGetter = () => null;
let _setTokens: TokenSetter = () => {};
let _logout: LogoutFn = () => {};

/** Called once by auth store to wire up token access */
export function configureAuth(
  getAccess: TokenGetter,
  getRefresh: TokenGetter,
  setTokens: TokenSetter,
  logout: LogoutFn,
) {
  _getAccessToken = getAccess;
  _getRefreshToken = getRefresh;
  _setTokens = setTokens;
  _logout = logout;
}

// ============================================================
// API Error class
// ============================================================
export class ApiError extends Error {
  code: string;
  status: number;
  details?: { field: string; message: string }[];
  /**
   * Free-form structured context (e.g. `{ email }` on EMAIL_NOT_VERIFIED)
   * forwarded from the backend filter. Read it with a narrow guard:
   *   if (err.code === 'EMAIL_NOT_VERIFIED') {
   *     const email = (err.meta?.email as string) ?? '';
   *   }
   */
  meta?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: { field: string; message: string }[],
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.meta = meta;
  }

  /** Get error message for a specific field (useful for forms) */
  getFieldError(field: string): string | undefined {
    return this.details?.find((d) => d.field === field)?.message;
  }

  /** Get all field errors as a record (useful for react-hook-form) */
  getFieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    this.details?.forEach((d) => {
      errors[d.field] = d.message;
    });
    return errors;
  }

  /** Human-readable message for toasts, including validation details when present. */
  getDisplayMessage(fallback = 'Something went wrong'): string {
    if (this.details?.length) {
      return this.details.map((d) => `• ${d.message}`).join('\n');
    }
    return this.message || fallback;
  }
}

// ============================================================
// Refresh token logic (prevents concurrent refreshes)
// ============================================================
let _refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = _getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.success && json.data) {
      _setTokens(json.data.accessToken, json.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function ensureRefresh(): Promise<boolean> {
  if (!_refreshPromise) {
    _refreshPromise = refreshAccessToken().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

// ============================================================
// Core request function
// ============================================================
interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  isFormData?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, isFormData, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'X-Client-Platform': 'WEB',
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = _getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers as Record<string, string>) },
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  // Handle 401 — try refresh once
  if (res.status === 401 && !skipAuth) {
    const refreshed = await ensureRefresh();
    if (refreshed) {
      // Retry with new token
      const newToken = _getAccessToken();
      const retryHeaders = { ...headers };
      if (newToken) retryHeaders['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_URL}${path}`, {
        ...fetchOptions,
        headers: { ...retryHeaders, ...(fetchOptions.headers as Record<string, string>) },
        body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
      });
      return handleResponse<T>(retryRes);
    }
    _logout();
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
  }

  return handleResponse<T>(res);
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch (e) {
    // Body wasn't valid JSON — for non-2xx responses this is sometimes expected.
    // For successful 2xx responses with empty body, return null.
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }
    return null;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await safeJson(res);

  if (!res.ok) {
    const errBody = (json || {}) as ApiErrorResponse;
    throw new ApiError(
      res.status,
      errBody.error?.code || 'UNKNOWN_ERROR',
      errBody.error?.message || `Request failed with status ${res.status}`,
      errBody.error?.details,
      errBody.error?.meta,
    );
  }

  if (json === null) {
    return null as T;
  }

  // Unwrap the standard { success, data, meta } wrapper
  const apiRes = json as ApiResponse<T>;
  if (apiRes.success !== undefined) {
    let result = apiRes.data;
    // Some backend services return { data: [...] } which gets double-wrapped.
    // Unwrap that inner layer if it exists and looks like a plain wrapper.
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const inner = result as Record<string, unknown>;
      if ('data' in inner && Object.keys(inner).length <= 2) {
        // It's a wrapper like { data: [...] } or { data: [...], someOtherField }
        // Only unwrap if data is an array (the common double-wrap case)
        if (Array.isArray(inner.data)) {
          return inner.data as T;
        }
      }
    }
    return result;
  }

  // Fallback: return as-is if not wrapped
  return json as T;
}

// ============================================================
// Public API methods
// ============================================================

/** GET request — unwraps response.data automatically */
export function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'GET' });
}

/** GET request for paginated endpoints — returns { items, meta } */
export async function getPaginated<T>(path: string, options?: RequestOptions): Promise<PaginatedResult<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(!options?.skipAuth && _getAccessToken() ? { Authorization: `Bearer ${_getAccessToken()}` } : {}),
      ...(options?.headers as Record<string, string>),
    },
  });

  if (res.status === 401 && !options?.skipAuth) {
    const refreshed = await ensureRefresh();
    if (refreshed) {
      const retryRes = await fetch(`${API_URL}${path}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${_getAccessToken()}`,
        },
      });
      return handlePaginatedResponse<T>(retryRes);
    }
    _logout();
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired.');
  }

  return handlePaginatedResponse<T>(res);
}

async function handlePaginatedResponse<T>(res: Response): Promise<PaginatedResult<T>> {
  const json = (await safeJson(res)) || {};
  if (!res.ok) {
    const errBody = json as ApiErrorResponse;
    throw new ApiError(
      res.status,
      errBody.error?.code || 'UNKNOWN_ERROR',
      errBody.error?.message || `Request failed with status ${res.status}`,
      errBody.error?.details,
    );
  }

  // Backend returns: { success: true, data: { data: [...], meta: {...} } }
  // The outer wrapper has success + data. The inner data has data[] + meta.
  const outer = json as { success?: boolean; data?: unknown; meta?: PaginationMeta };
  let items: T[] = [];
  let meta: PaginationMeta = { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false };

  const payload = outer.success !== undefined ? outer.data : json;

  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.data)) {
      items = p.data as T[];
      if (p.meta && typeof p.meta === 'object') {
        meta = p.meta as PaginationMeta;
      }
    } else if (Array.isArray(payload)) {
      items = payload as T[];
    }
  }

  // Also check if meta is at the outer level
  if (outer.meta && typeof outer.meta === 'object') {
    meta = outer.meta as PaginationMeta;
  }

  return { items, meta };
}

/** POST request */
export function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'POST', body });
}

/** PATCH request */
export function patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'PATCH', body });
}

/** PUT request */
export function put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'PUT', body });
}

/** DELETE request */
export function del<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'DELETE' });
}

/** POST with FormData (for file uploads). Supports custom method via options.method */
export function postFormData<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: options?.method || 'POST', body: formData, isFormData: true });
}

/**
 * Download a file (e.g. CSV/PDF export) from an authenticated endpoint.
 * Streams the response body into a Blob, triggers a browser download, and
 * uses the server's Content-Disposition filename if present.
 */
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const token = _getAccessToken();
  let res = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401) {
    const refreshed = await ensureRefresh();
    if (!refreshed) {
      _logout();
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expired.');
    }
    const newToken = _getAccessToken();
    res = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      headers: { ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}) },
    });
  }
  if (!res.ok) {
    throw new ApiError(res.status, 'DOWNLOAD_FAILED', `Download failed: ${res.status}`);
  }

  let filename = fallbackFilename;
  const disposition = res.headers.get('Content-Disposition');
  if (disposition) {
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    if (match?.[1]) filename = decodeURIComponent(match[1]);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export base URL for image URLs */
export function getFileUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
