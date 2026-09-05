'use client';

import Link from 'next/link';
import { formatDate, formatMoney } from '@/lib/format';
import type { ReconciliationPayment } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import styles from './reconciliation.module.css';

const COLUMNS: Column<ReconciliationPayment>[] = [
  {
    key: 'paymentNumber',
    header: 'Payment',
    nowrap: true,
    render: (payment) => (
      <div className={styles.cellStack}>
        <span>{payment.paymentNumber}</span>
        <span className={styles.cellMeta}>{formatDate(payment.paymentDate)}</span>
      </div>
    ),
  },
  {
    key: 'claim',
    header: 'Claim',
    nowrap: true,
    render: (payment) => (
      <Link href={`/claims/${payment.payable.claim.id}`} className="text-link">
        {payment.payable.claim.claimNumber}
      </Link>
    ),
  },
  {
    key: 'account',
    header: 'Settlement Account',
    render: (payment) => payment.settlementAccount.name,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    render: (payment) => formatMoney(payment.paymentAmount, payment.paymentCurrencyCode),
  },
  {
    key: 'unmatched',
    header: 'Unmatched',
    align: 'right',
    render: (payment) => formatMoney(payment.unmatchedAmount, payment.paymentCurrencyCode),
  },
  {
    key: 'status',
    header: 'Reconciliation',
    render: (payment) => (
      <StatusBadge kind="reconciliation" status={payment.reconciliationStatus} />
    ),
  },
];

export function PaymentsPanel({
  payments,
  loading,
}: {
  payments: ReconciliationPayment[];
  loading: boolean;
}) {
  return (
    <Card
      title="Successful Payments"
      subtitle="Payment execution and reconciliation are tracked independently."
      flush
    >
      <DataTable
        columns={COLUMNS}
        rows={payments}
        rowKey={(payment) => payment.id}
        loading={loading}
        emptyMessage="No successful payments yet."
      />
    </Card>
  );
}
