'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import { Icon } from '@/components/ui/icon';
import styles from './topbar.module.css';

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  claims: 'Claims Register',
  new: 'Create Claim',
  parties: 'Parties',
  policies: 'Policies',
  reconciliation: 'Reconciliation',
  accounting: 'Accounting',
  audit: 'Audit Logs',
  profile: 'Users & Roles',
};

function breadcrumbsFromPath(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((segment, index) => ({
    label: SEGMENT_LABELS[segment] ?? (segment.length > 20 ? 'Detail' : segment),
    href: `/${segments.slice(0, index + 1).join('/')}`,
  }));
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const crumbs = breadcrumbsFromPath(pathname);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('q');
    if (typeof query === 'string' && query.trim()) {
      router.push(`/claims?search=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header className={styles.topbar}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
        {crumbs.map((crumb, index) => (
          <span key={crumb.href} className={styles.crumb}>
            {index > 0 ? (
              <span className={styles.separator} aria-hidden="true">
                <Icon name="chevron-right" size={12} />
              </span>
            ) : null}
            {index === crumbs.length - 1 ? (
              <span aria-current="page" className={styles.current}>
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className={styles.crumbLink}>
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <div className={styles.actions}>
        <form onSubmit={submitSearch} className={styles.search} role="search">
          <span className={styles.searchIcon}>
            <Icon name="search" size={14} />
          </span>
          <input
            type="search"
            name="q"
            placeholder="Search claims…"
            aria-label="Search claims"
            className={styles.searchInput}
          />
        </form>
        {user ? (
          <div className={styles.menu} ref={menuRef}>
            <button
              type="button"
              className={styles.avatarButton}
              aria-haspopup="menu"
              aria-label="Open account menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initials(user.firstName, user.lastName)}
              </span>
              <Icon name="chevron-down" size={14} />
            </button>
            {menuOpen ? (
              <div role="menu" className={styles.dropdown}>
                <div className={styles.menuHeader}>
                  <p className={styles.menuName}>
                    {user.firstName} {user.lastName}
                  </p>
                  <p className={styles.menuEmail}>{user.email}</p>
                </div>
                <Link
                  href="/profile"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name="users" size={14} />
                  Profile & access
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => void logout()}
                >
                  <Icon name="logout" size={14} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
