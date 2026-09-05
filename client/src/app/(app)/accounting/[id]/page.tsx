'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { enumLabel, formatDate } from '@/lib/format';
import type { Journal } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/feedback';
import { Pill } from '@/components/ui/status-badge';
import type { JournalLine } from '@/lib/types';
import styles from '../accounting.module.css';

const LINE_COLUMNS: Column<JournalLine>[] = [
  {
    key: 'account',
    header: 'Account',
    render: (line) =>
      line.glAccount.code ? `${line.glAccount.code} — ${line.glAccount.name}` : line.glAccount.name,
  },
  { key: 'debitAmount', header: 'Debit', align: 'right' },
  { key: 'creditAmount', header: 'Credit', align: 'right' },
];

export default function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [journal, setJournal] = useState<Journal>();
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ data: Journal }>(`/accounting/journals/${id}`)
      .then((response) => setJournal(response.data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'The journal could not load.'),
      );
  }, [id]);

  if (error) return <p role="alert">{error}</p>;
  if (!journal) {
    return (
      <div role="status" aria-label="Loading journal" style={{ display: 'grid', gap: '0.75rem' }}>
        <Skeleton width="14rem" height="1.5rem" />
        <Skeleton width="100%" height="8rem" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={journal.journalNumber}
        badge={
          <>
            <Pill tone="info">{enumLabel(journal.sourceType)}</Pill>
            {journal.status ? (
              <Pill tone={journal.status === 'POSTED' ? 'success' : 'danger'}>
                {enumLabel(journal.status)}
              </Pill>
            ) : null}
          </>
        }
        subtitle={journal.description ?? undefined}
      />
      <Card>
        <div className={styles.meta}>
          {journal.claim ? (
            <span>
              Claim:{' '}
              <Link href={`/claims/${journal.claim.id}`} className="text-link">
                {journal.claim.claimNumber}
              </Link>
            </span>
          ) : null}
          <span>Date: {formatDate(journal.entryDate)}</span>
          <span>Currency: {journal.currencyCode}</span>
        </div>
        {journal.reversalOf || journal.reversals?.length ? (
          <div className={styles.links} style={{ marginTop: 'var(--space-3)' }}>
            {journal.reversalOf ? (
              <span>
                Reverses{' '}
                <Link href={`/accounting/${journal.reversalOf.id}`} className="text-link">
                  {journal.reversalOf.journalNumber}
                </Link>
              </span>
            ) : null}
            {journal.reversals?.map((reversal) => (
              <span key={reversal.id}>
                Reversed by{' '}
                <Link href={`/accounting/${reversal.id}`} className="text-link">
                  {reversal.journalNumber}
                </Link>
              </span>
            ))}
          </div>
        ) : null}
      </Card>
      <Card title="Lines" flush>
        <DataTable
          columns={LINE_COLUMNS}
          rows={journal.lines ?? []}
          rowKey={(line) => line.id}
          emptyMessage="No lines."
        />
      </Card>
    </>
  );
}
