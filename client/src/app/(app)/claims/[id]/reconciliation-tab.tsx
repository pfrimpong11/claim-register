'use client';

import { formatDate, formatMoney } from '@/lib/format';
import { usePermission } from '@/lib/auth';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useClaimPayments, type PaymentWithPayable } from './use-claim-payments';
import styles from './claim-tabs.module.css';

const COLUMNS: Column<PaymentWithPayable>[] = [
  { key: 'paymentNumber', header: 'Payment No.', nowrap: true },
  {
    key: 'paymentDate',
    header: 'Date',
    nowrap: true,
    render: (payment) => formatDate(payment.paymentDate),
  },
  {
    key: 'account',
    header: 'Settlement Account',
    render: (payment) => payment.settlementAccount?.name ?? '—',
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    render: (payment) => formatMoney(payment.paymentAmount, payment.paymentCurrencyCode),
  },
  {
    key: 'reconciliation',
    header: 'Reconciliation',
    render: (payment) => (
      <div className={styles.reconRow}>
        {/* The raw status text is load-bearing for monitoring and tests. */}
        <div>Reconciliation: {payment.reconciliationStatus}</div>
        <StatusBadge kind="reconciliation" status={payment.reconciliationStatus} />
      </div>
    ),
  },
  {
    key: 'matched',
    header: 'Matched',
    align: 'right',
    render: (payment) =>
      formatMoney(payment.reconciliationMatchedAmount, payment.paymentCurrencyCode),
  },
  {
    key: 'unmatched',
    header: 'Unmatched',
    align: 'right',
    render: (payment) =>
      formatMoney(payment.reconciliationUnmatchedAmount, payment.paymentCurrencyCode),
  },
];

export function ReconciliationTab({ claimId }: { claimId: string }) {
  const { payments, loading, error } = useClaimPayments(claimId);
  const canReconcile = usePermission('reconciliation.view');
  const successful = payments.filter((payment) => payment.status === 'SUCCESSFUL');

  return (
    <Card
      title="Reconciliation"
      subtitle="Successful payments and their matches against imported bank and mobile-money evidence."
      actions={
        canReconcile ? (
          <ButtonLink href="/reconciliation" variant="secondary" size="sm" icon="reconciliation">
            Open workspace
          </ButtonLink>
        ) : undefined
      }
      flush
    >
      {error ? <p role="alert">{error}</p> : null}
      <DataTable
        columns={COLUMNS}
        rows={successful}
        rowKey={(payment) => payment.id}
        loading={loading && !error}
        emptyMessage="No successful payments to reconcile yet."
      />
    </Card>
  );
}
