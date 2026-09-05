'use client';

import { useCurrentUser } from '@/lib/auth';
import { enumLabel, initials } from '@/lib/format';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/status-badge';
import styles from './profile.module.css';

function groupPermissions(permissions: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const permission of permissions) {
    const [module] = permission.split('.');
    const entries = groups.get(module) ?? [];
    entries.push(permission);
    groups.set(module, entries);
  }
  return groups;
}

export function Profile() {
  const { user } = useCurrentUser();
  if (!user) return null;

  const groups = groupPermissions(user.permissions);

  return (
    <>
      <PageHeader
        title="Users & Roles"
        subtitle="Your account, roles, and permissions. User administration is managed by seed data in this environment."
      />
      <Card title="Account">
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.firstName, user.lastName)}
          </span>
          <div>
            <p className={styles.name}>
              {user.firstName} {user.lastName}
            </p>
            <p className={styles.email}>{user.email}</p>
          </div>
        </div>
      </Card>
      <Card title="Roles">
        <div className={styles.pillRow}>
          {user.roles.map((role) => (
            <Pill key={role} tone="info">
              {enumLabel(role)}
            </Pill>
          ))}
        </div>
      </Card>
      <Card
        title="Permissions"
        subtitle={`${user.permissions.length} permissions across ${groups.size} modules`}
      >
        <div className={styles.permissionGrid}>
          {[...groups.entries()].map(([module, permissions]) => (
            <div key={module} className={styles.permissionGroup}>
              <h3 className={styles.groupTitle}>{enumLabel(module)}</h3>
              <ul className={styles.permissionList}>
                {permissions.map((permission) => (
                  <li key={permission}>
                    <code className={styles.permissionCode}>{permission}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
