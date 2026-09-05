'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '@/components/ui/icon';
import styles from './sidebar.module.css';

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  permission?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/claims', label: 'Claims Register', icon: 'claims', permission: 'claims.view' },
  { href: '/claims/new', label: 'Create Claim', icon: 'plus', permission: 'claims.create' },
  { href: '/parties', label: 'Parties', icon: 'users', permission: 'parties.view' },
  { href: '/policies', label: 'Policies', icon: 'policy', permission: 'policies.view' },
  {
    href: '/reconciliation',
    label: 'Reconciliation',
    icon: 'reconciliation',
    permission: 'reconciliation.view',
  },
  { href: '/accounting', label: 'Accounting', icon: 'journal', permission: 'accounting.view' },
  { href: '/profile', label: 'Users & Roles', icon: 'shield' },
  { href: '/audit', label: 'Audit Logs', icon: 'audit', permission: 'audit.view' },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || user?.permissions.includes(item.permission),
  );

  const activeHref = visibleItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .reduce<string | null>(
      (best, item) => (best && best.length >= item.href.length ? best : item.href),
      null,
    );

  return (
    <aside className={cx(styles.sidebar, collapsed && styles.collapsed)}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <Icon name="shield" size={18} />
        </span>
        {!collapsed ? <span className={styles.brandName}>Claims Register</span> : null}
      </div>
      {!collapsed && user ? (
        <div className={styles.userCard}>
          <span className={styles.avatar} aria-hidden="true">
            {`${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()}
          </span>
          <span className={styles.userMeta}>
            <span className={styles.userName}>
              {user.firstName} {user.lastName}
            </span>
            <span className={styles.userRole}>{user.roles.join(', ').replaceAll('_', ' ')}</span>
          </span>
        </div>
      ) : null}
      <nav className={styles.nav} aria-label="Main navigation">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cx(styles.navItem, item.href === activeHref && styles.active)}
            aria-current={item.href === activeHref ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
          >
            <Icon name={item.icon} size={16} />
            {!collapsed ? <span>{item.label}</span> : null}
          </Link>
        ))}
      </nav>
      <button type="button" className={styles.collapseButton} onClick={onToggle}>
        <Icon
          name={collapsed ? 'chevron-right' : 'collapse'}
          size={16}
          aria-hidden={collapsed ? undefined : 'true'}
        />
        {!collapsed ? <span>Collapse</span> : <span className={styles.srOnly}>Expand sidebar</span>}
      </button>
    </aside>
  );
}
