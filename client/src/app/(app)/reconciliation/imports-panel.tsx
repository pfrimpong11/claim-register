'use client';

import { enumLabel } from '@/lib/format';
import type { TransactionImport } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import styles from './reconciliation.module.css';

const COLUMNS: Column<TransactionImport>[] = [
  { key: 'sourceFileName', header: 'File' },
  {
    key: 'account',
    header: 'Account / Source',
    render: (item) => (
      <div className={styles.cellStack}>
        <span>{item.settlementAccount.name}</span>
        <span className={styles.cellMeta}>{enumLabel(item.sourceType ?? '')}</span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (item) => <StatusBadge kind="import" status={item.status} />,
  },
  {
    key: 'rows',
    header: 'Rows',
    render: (item) => (
      <div className={styles.cellStack}>
        <span>
          {item.importedRows} imported · {item.duplicateRows} duplicates · {item.failedRows} failed
        </span>
        {item.errorSummary?.length ? (
          <details>
            <summary>Errors ({item.errorSummary.length})</summary>
            <div className={styles.errorList}>
              {item.errorSummary.map((entry, index) => (
                <span key={index}>
                  Row {entry.row ?? 'file'}: {entry.message}
                </span>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    ),
  },
];

export function ImportsPanel({
  imports,
  loading,
}: {
  imports: TransactionImport[];
  loading: boolean;
}) {
  return (
    <Card title="Imports" subtitle="The most recent CSV imports and their row-level results." flush>
      <DataTable
        columns={COLUMNS}
        rows={imports}
        rowKey={(item) => item.id}
        loading={loading}
        emptyMessage="No imports yet. Use Import Transactions to upload a statement."
      />
    </Card>
  );
}
