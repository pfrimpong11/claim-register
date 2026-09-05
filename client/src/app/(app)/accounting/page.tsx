'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { enumLabel, formatDate } from '@/lib/format';
import type { Journal } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pill } from '@/components/ui/status-badge';
import styles from './accounting.module.css';

const COLUMNS: Column<Journal>[] = [
  {
    key: 'journalNumber',
    header: 'Journal',
    nowrap: true,
    render: (journal) => (
      <Link href={`/accounting/${journal.id}`} className="text-link">
        {journal.journalNumber}
      </Link>
    ),
  },
  {
    key: 'entryDate',
    header: 'Date',
    nowrap: true,
    render: (journal) => formatDate(journal.entryDate),
  },
  {
    key: 'sourceType',
    header: 'Source',
    render: (journal) => <Pill tone="info">{enumLabel(journal.sourceType)}</Pill>,
  },
  {
    key: 'claim',
    header: 'Claim',
    nowrap: true,
    render: (journal) =>
      journal.claim ? (
        <Link href={`/claims/${journal.claim.id}`} className="text-link">
          {journal.claim.claimNumber}
        </Link>
      ) : (
        '—'
      ),
  },
  { key: 'description', header: 'Description', render: (journal) => journal.description ?? '—' },
  {
    key: 'lines',
    header: 'Lines',
    render: (journal) => (
      <div className={styles.lines}>
        {journal.lines?.map((line) => (
          <span key={line.id}>
            {line.glAccount.name}: {journal.currencyCode} Dr {line.debitAmount} / Cr{' '}
            {line.creditAmount}
          </span>
        ))}
      </div>
    ),
  },
];

export default function AccountingPage() {
  const [journals, setJournals] = useState<Journal[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ data: Journal[] }>('/accounting/journals')
      .then((response) => setJournals(response.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Journals could not load.'));
  }, []);

  return (
    <>
      <PageHeader
        title="Journal Entries"
        subtitle="Read-only general ledger postings from payable approvals, payments, and reversals."
      />
      {error ? <p role="alert">{error}</p> : null}
      <Card flush>
        <DataTable
          columns={COLUMNS}
          rows={journals ?? []}
          rowKey={(journal) => journal.id}
          loading={journals === undefined && !error}
          emptyMessage="No journals found."
        />
      </Card>
    </>
  );
}
