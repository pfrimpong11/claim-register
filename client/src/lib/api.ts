import type { AuthenticatedUser } from '@/lib/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export type { AuthenticatedUser };

// When the API lives on another site
const CSRF_TOKEN_STORAGE_KEY = 'claims_csrf_token';

export function rememberCsrfToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(CSRF_TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode, blocked site data); the cookie path still works.
  }
}

function storedCsrfToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CSRF_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
  });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      rememberCsrfToken(null);
      window.dispatchEvent(new CustomEvent('api:unauthorized'));
    }
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export type MutateOptions = {
  method?: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Adds an Idempotency-Key header (required by payment and reconciliation mutations). */
  idempotent?: boolean;
};

export function apiMutate<T>(path: string, options: MutateOptions = {}): Promise<T> {
  const { method = 'POST', body, idempotent = false } = options;
  const headers: Record<string, string> = {
    'X-CSRF-Token': readCookie('claims_csrf') ?? storedCsrfToken() ?? '',
  };
  if (idempotent) headers['Idempotency-Key'] = crypto.randomUUID();
  return apiRequest<T>(path, {
    method,
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
}

export function readCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}
