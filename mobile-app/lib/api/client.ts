import { API_URL } from '../../constants/config';

// ============================================================
// Token management — wired up by auth store
// ============================================================
type TokenGetter = () => string | null;
type TokenSetter = (access: string, refresh: string) => void;
type LogoutFn = () => void;

let _getAccessToken: TokenGetter = () => null;
let _getRefreshToken: TokenGetter = () => null;
let _setTokens: TokenSetter = () => {};
let _logout: LogoutFn = () => {};

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
// API Error
// ============================================================
export class ApiError extends Error {
  code: string;
  status: number;
  details?: { field: string; message: string }[];
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
}

// ============================================================
// Token refresh
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
    _refreshPromise = refreshAccessToken().finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

// ============================================================
// Core request
// ============================================================
interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  isFormData?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, isFormData, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'X-Client-Platform': 'MOBILE',
  };

  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (!skipAuth) {
    const token = _getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers as Record<string, string>) },
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuth) {
    const refreshed = await ensureRefresh();
    if (refreshed) {
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

async function handleResponse<T>(res: Response): Promise<T> {
  let json: any;
  try {
    json = await res.json();
  } catch {
    json = res.status === 204 ? null : {};
  }
  if (!res.ok) {
    const errBody = (json || {}) as any;
    throw new ApiError(
      res.status,
      errBody.error?.code || 'UNKNOWN_ERROR',
      errBody.error?.message || `Request failed (${res.status})`,
      errBody.error?.details,
      errBody.error?.meta,
    );
  }
  const apiRes = json as any;
  if (apiRes.success !== undefined) {
    let result = apiRes.data;
    // Unwrap double-wrapped arrays: { data: [...] }
    // BUT preserve if `meta` is present (paginated response)
    if (result && typeof result === 'object' && !Array.isArray(result) && 'data' in result && Array.isArray(result.data)) {
      if ('meta' in result) {
        return result as T; // Keep { data: [...], meta: {...} } for paginated responses
      }
      return result.data as T;
    }
    return result;
  }
  return json as T;
}

// ============================================================
// Public methods
// ============================================================
export function get<T>(path: string, opts?: RequestOptions) { return request<T>(path, { ...opts, method: 'GET' }); }
export function post<T>(path: string, body?: unknown, opts?: RequestOptions) { return request<T>(path, { ...opts, method: 'POST', body }); }
export function patch<T>(path: string, body?: unknown, opts?: RequestOptions) { return request<T>(path, { ...opts, method: 'PATCH', body }); }
export function put<T>(path: string, body?: unknown, opts?: RequestOptions) { return request<T>(path, { ...opts, method: 'PUT', body }); }
export function del<T>(path: string, opts?: RequestOptions) { return request<T>(path, { ...opts, method: 'DELETE' }); }
export function postFormData<T>(path: string, formData: FormData, opts?: RequestOptions) {
  return request<T>(path, { ...opts, method: 'POST', body: formData, isFormData: true });
}

export async function getPaginated<T>(path: string, opts?: RequestOptions): Promise<{ items: T[]; meta: any }> {
  // Use the core `request` function — gets 401 auto-refresh for free
  const json = await request<any>(path, { ...opts, method: 'GET' });

  // After handleResponse:
  //   - Paginated: { data: [...], meta: {...} }  (preserved because meta is present)
  //   - Flat array: [...]
  //   - Non-paginated object: { data: [...] }  → unwrapped to [...]
  let items: T[] = [];
  const defaultMeta = { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false };

  if (Array.isArray(json)) {
    items = json;
  } else if (json && typeof json === 'object') {
    if (Array.isArray(json.data)) {
      items = json.data;
    }
    if (json.meta) return { items, meta: json.meta };
  }
  return { items, meta: defaultMeta };
}

export function getFileUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
