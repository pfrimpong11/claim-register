'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiMutate, apiRequest, rememberCsrfToken } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/types';

type AuthContextValue = {
  user: AuthenticatedUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const redirectToLogin = useCallback(() => {
    const next =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [router]);

  const refresh = useCallback(() => {
    // Only a 401 means the session is gone; transient failures (rate limits,
    // network blips) are retried so an active session is not bounced to login.
    const attempt = (retriesLeft: number): Promise<void> =>
      apiRequest<{ data: { user: AuthenticatedUser } }>('/auth/me')
        .then((response) => {
          setUser(response.data.user);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (retriesLeft > 0 && !(error instanceof ApiError && error.status === 401)) {
            return new Promise<void>((resolve) => {
              window.setTimeout(() => resolve(attempt(retriesLeft - 1)), 2000);
            });
          }
          setUser(null);
          setLoading(false);
          redirectToLogin();
        });
    return attempt(3);
  }, [redirectToLogin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
      redirectToLogin();
    }
    window.addEventListener('api:unauthorized', onUnauthorized);
    return () => window.removeEventListener('api:unauthorized', onUnauthorized);
  }, [redirectToLogin]);

  const logout = useCallback(async () => {
    try {
      await apiMutate('/auth/logout');
    } catch {
      // Session may already be gone; still return to the login screen.
    }
    rememberCsrfToken(null);
    setUser(null);
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function useCurrentUser(): { user: AuthenticatedUser | null; loading: boolean } {
  const { user, loading } = useAuth();
  return { user, loading };
}

/** True when the current user holds any of the given permission codes. */
export function usePermission(code: string | string[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  const codes = Array.isArray(code) ? code : [code];
  return codes.some((entry) => user.permissions.includes(entry));
}
