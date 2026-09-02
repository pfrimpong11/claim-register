'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest, AuthenticatedUser, readCookie } from '@/lib/api';

export function DashboardShell() {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ data: { user: AuthenticatedUser } }>('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => router.replace('/login'));
  }, [router]);

  async function logout() {
    const csrfToken = readCookie('claims_csrf');
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      });
      router.replace('/login');
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Sign out failed.');
    }
  }

  if (!user) return <p role="status">Loading your workspace…</p>;

  return (
    <section aria-labelledby="dashboard-title">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Authenticated workspace</p>
          <h1 id="dashboard-title">Welcome, {user.firstName}</h1>
        </div>
        <button type="button" className="secondary" onClick={logout}>
          Sign out
        </button>
      </div>
      <p>{user.email}</p>
      <p>Roles: {user.roles.join(', ')}</p>
      <nav aria-label="Primary navigation">
        <Link href="/claims">Claims</Link>
        {user.permissions.includes('accounting.view') ? (
          <Link href="/accounting">Accounting</Link>
        ) : null}
        {user.permissions.includes('audit.view') ? <span>Audit</span> : null}
      </nav>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
