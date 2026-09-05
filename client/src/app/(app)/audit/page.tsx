'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { AuditEntry, ListMeta } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterBar, FilterItem, FilterSpacer } from '@/components/ui/filter-bar';
import { DateInput, Input } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import styles from './audit.module.css';

const COLUMNS: Column<AuditEntry>[] = [
  {
    key: 'occurredAt',
    header: 'Date / Time',
    nowrap: true,
    render: (entry) => formatDateTime(entry.occurredAt),
  },
  {
    key: 'actor',
    header: 'User',
    nowrap: true,
    render: (entry) =>
      entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : 'System',
  },
  {
    key: 'action',
    header: 'Action',
    render: (entry) => <code className={styles.actionCode}>{entry.action}</code>,
  },
  {
    key: 'entity',
    header: 'Entity',
    render: (entry) => (
      <div className={styles.entityCell}>
        <span>{entry.entityType}</span>
        {entry.entityId ? <span className={styles.entityId}>{entry.entityId}</span> : null}
      </div>
    ),
  },
  {
    key: 'changes',
    header: 'Details',
    render: (entry) =>
      entry.oldValues || entry.newValues ? (
        <details>
          <summary>View masked data</summary>
          <pre className={styles.changes}>
            {JSON.stringify({ before: entry.oldValues, after: entry.newValues }, null, 2)}
          </pre>
        </details>
      ) : (
        '—'
      ),
  },
];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>();
  const [meta, setMeta] = useState<ListMeta>();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    apiRequest<{ data: AuditEntry[]; meta?: ListMeta }>(`/audit-logs?${params}`)
      .then((response) => {
        setEntries(response.data);
        setMeta(response.meta);
        setError('');
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'The audit trail could not load.'),
      );
  }, [query, page]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ['action', 'entityType', 'entityId', 'from', 'to']) {
      const value = form.get(key);
      if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
    }
    setPage(1);
    setQuery(params.toString());
  }

  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle="Every recorded action with masked before/after values."
      />
      <Card>
        <form onSubmit={applyFilters}>
          <FilterBar>
            <FilterItem label="Action" htmlFor="audit-action" grow>
              <Input id="audit-action" name="action" placeholder="e.g. PAYMENT_APPROVED" />
            </FilterItem>
            <FilterItem label="Entity type" htmlFor="audit-entity-type">
              <Input id="audit-entity-type" name="entityType" placeholder="e.g. CLAIM" />
            </FilterItem>
            <FilterItem label="Entity ID" htmlFor="audit-entity-id">
              <Input id="audit-entity-id" name="entityId" />
            </FilterItem>
            <FilterItem label="From" htmlFor="audit-from">
              <DateInput id="audit-from" name="from" />
            </FilterItem>
            <FilterItem label="To" htmlFor="audit-to">
              <DateInput id="audit-to" name="to" />
            </FilterItem>
            <FilterSpacer />
            <Button type="submit" variant="secondary" icon="filter">
              Filter
            </Button>
          </FilterBar>
        </form>
      </Card>
      {error ? <p role="alert">{error}</p> : null}
      <Card flush>
        <DataTable
          columns={COLUMNS}
          rows={entries ?? []}
          rowKey={(entry) => entry.id}
          loading={entries === undefined && !error}
          emptyMessage="No audit events found."
          footer={
            meta && meta.total > (meta.pageSize ?? 50) ? (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages ?? Math.ceil(meta.total / meta.pageSize)}
                total={meta.total}
                pageSize={meta.pageSize}
                onPageChange={setPage}
              />
            ) : undefined
          }
        />
      </Card>
    </>
  );
}
