'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { useCurrentUser } from '@/lib/auth';
import { Skeleton } from '@/components/ui/feedback';
import { cx } from '@/lib/cx';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import styles from './app-shell.module.css';

const COLLAPSE_KEY = 'claims-sidebar-collapsed';
const COLLAPSE_EVENT = 'claims-sidebar-collapsed-change';

function subscribeToCollapse(callback: () => void) {
  window.addEventListener(COLLAPSE_EVENT, callback);
  return () => window.removeEventListener(COLLAPSE_EVENT, callback);
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser();
  const collapsed = useSyncExternalStore(subscribeToCollapse, readCollapsed, () => false);

  const toggleCollapsed = useCallback(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1');
    } catch {
      // Ignore storage failures; the toggle simply won't persist.
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }, [collapsed]);

  if (loading) {
    return (
      <div className={styles.loading} role="status" aria-label="Loading your workspace">
        <Skeleton width="18rem" height="1.25rem" />
        <Skeleton width="28rem" height="0.9rem" />
        <Skeleton width="24rem" height="0.9rem" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={cx(styles.shell, collapsed && styles.collapsed)}>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className={styles.content}>
        <Topbar />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
