'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import { enumLabel, formatDateTime } from '@/lib/format';
import type { AuditEntry, Claim } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Timeline } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/data-table';
import styles from './claim-tabs.module.css';

const AUDIT_COLUMNS: Column<AuditEntry>[] = [
  {
    key: 'occurredAt',
    header: 'Date / Time',
    nowrap: true,
    render: (entry) => formatDateTime(entry.occurredAt),
  },
  {
    key: 'actor',
    header: 'User',
    render: (entry) =>
      entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : 'System',
  },
  { key: 'action', header: 'Action', render: (entry) => enumLabel(entry.action) },
  { key: 'entityType', header: 'Entity', nowrap: true },
];

export function ActivityTab({ claim }: { claim: Claim }) {
  const canViewAudit = usePermission('audit.view');
  const [entries, setEntries] = useState<AuditEntry[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canViewAudit) return;
    apiRequest<{ data: AuditEntry[] }>(`/audit-logs?claimId=${claim.id}`)
      .then((response) => setEntries(response.data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'The audit trail could not load.'),
      );
  }, [canViewAudit, claim.id]);

  return (
    <div className={styles.stack}>
      <Card title="Status History">
        {claim.statusHistory?.length ? (
          <Timeline
            items={claim.statusHistory.map((event) => ({
              key: event.id,
              title: enumLabel(event.toStatus),
              meta: formatDateTime(event.changedAt),
            }))}
          />
        ) : (
          <p>No status changes recorded.</p>
        )}
      </Card>
      {canViewAudit ? (
        <Card title="Audit Trail" flush>
          {error ? <p role="alert">{error}</p> : null}
          <DataTable
            columns={AUDIT_COLUMNS}
            rows={entries ?? []}
            rowKey={(entry) => entry.id}
            loading={entries === undefined && !error}
            emptyMessage="No audit events recorded for this claim."
          />
        </Card>
      ) : null}
    </div>
  );
}
