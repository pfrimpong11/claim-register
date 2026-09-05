'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '@/components/ui/icon';
import styles from './sidebar.module.css';

type NavItem = { href: string; label: string; icon: IconName; permission?: string };
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { href: '/claims', label: 'Claims Register', icon: 'claims', permission: 'claims.view' },
      {
        href: '/reconciliation',
        label: 'Reconciliation',
        icon: 'reconciliation',
        permission: 'reconciliation.view',
      },
      { href: '/accounting', label: 'Accounting', icon: 'journal', permission: 'accounting.view' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { href: '/parties', label: 'Parties', icon: 'users', permission: 'parties.view' },
      { href: '/policies', label: 'Policies', icon: 'policy', permission: 'policies.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/audit', label: 'Audit Logs', icon: 'audit', permission: 'audit.view' },
      { href: '/profile', label: 'Users & Roles', icon: 'shield' },
    ],
  },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || user?.permissions.includes(item.permission),
    ),
  })).filter((group) => group.items.length);
  return (
    <aside className={cx(styles.sidebar, collapsed && styles.collapsed)}>
      <Link href="/dashboard" className={styles.brand} aria-label="Claims Register home">
        <span className={styles.logo}>
          <Icon name="shield" size={24} />
        </span>
        <span className={styles.brandMeta}>
          <strong>Claims Register</strong>
          <span>Claims management</span>
        </span>
      </Link>
      {user?.permissions.includes('claims.create') ? (
        <Link
          href="/claims/new"
          className={cx(styles.create, pathname === '/claims/new' && styles.createActive)}
          aria-label="Create Claim"
          title="Create Claim"
          aria-current={pathname === '/claims/new' ? 'page' : undefined}
        >
          <Icon name="plus" size={18} />
          <span>Create Claim</span>
        </Link>
      ) : null}
      <nav className={styles.nav} aria-label="Main navigation">
        {groups.map((group) => (
          <div className={styles.group} key={group.label}>
            <p className={styles.groupLabel}>{group.label}</p>
            {group.items.map((item) => {
              const active =
                pathname !== '/claims/new' &&
                (pathname === item.href || pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(styles.navItem, active && styles.active)}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span className={styles.navIcon}>
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className={styles.navLabel}>{item.label}</span>
                  {active ? <span className={styles.activeDot} /> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={styles.footer}>
        {user ? (
          <Link
            href="/profile"
            className={styles.userCard}
            aria-label="Your profile"
            title="Your profile"
          >
            <span className={styles.avatar}>
              {`${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()}
            </span>
            <span className={styles.userMeta}>
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <span>{user.roles.join(', ').replaceAll('_', ' ')}</span>
            </span>
          </Link>
        ) : null}
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse'}
          title={collapsed ? 'Expand sidebar' : 'Collapse'}
        >
          <Icon name={collapsed ? 'chevron-right' : 'collapse'} size={16} />
          <span>Collapse navigation</span>
        </button>
      </div>
    </aside>
  );
}
