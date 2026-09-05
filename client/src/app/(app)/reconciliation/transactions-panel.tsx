'use client';

import { useMemo, useState } from 'react';
import { apiMutate } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import { enumLabel, formatDate, formatMoney } from '@/lib/format';
import type { ExternalTransaction, ReconciliationMatch, ReconciliationPayment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/overlay';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { MatchModal } from './match-modal';
import styles from './reconciliation.module.css';

type TabId = 'unmatched' | 'matched' | 'all';

export function TransactionsPanel({
  transactions,
  payments,
  loading,
  onChanged,
}: {
  transactions: ExternalTransaction[];
  payments: ReconciliationPayment[];
  loading: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canMatch = usePermission('reconciliation.match');
  const canUnmatch = usePermission('reconciliation.unmatch');
  const [tab, setTab] = useState<TabId>('unmatched');
  const [matching, setMatching] = useState<ExternalTransaction | null>(null);
  const [reversing, setReversing] = useState<ReconciliationMatch | null>(null);
  const [busy, setBusy] = useState(false);

  const unmatched = useMemo(
    () => transactions.filter((item) => item.reconciliationStatus !== 'MATCHED'),
    [transactions],
  );
  const matched = useMemo(
    () => transactions.filter((item) => item.reconciliationStatus === 'MATCHED'),
    [transactions],
  );
  const visible = tab === 'unmatched' ? unmatched : tab === 'matched' ? matched : transactions;

  async function reverse(reason?: string) {
    if (!reversing) return;
    setBusy(true);
    try {
      await apiMutate(`/reconciliation-matches/${reversing.id}/reverse`, {
        idempotent: true,
        body: { reason },
      });
      toast.success('Match reversed.');
      setReversing(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unmatch failed.');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<ExternalTransaction>[] = [
    {
      key: 'transactionDate',
      header: 'Date',
      nowrap: true,
      render: (transaction) => formatDate(transaction.transactionDate),
    },
    {
      key: 'source',
      header: 'Account / Source',
      render: (transaction) => (
        <div className={styles.cellStack}>
          <span>{transaction.settlementAccount.name}</span>
          <span className={styles.cellMeta}>{enumLabel(transaction.sourceType)}</span>
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Description',
      render: (transaction) => (
        <div className={styles.cellStack}>
          <span>{transaction.externalReference}</span>
          {transaction.description ? (
            <span className={styles.cellMeta}>{transaction.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (transaction) => (
        <div className={styles.cellStack}>
          <span>{formatMoney(transaction.amount, transaction.currencyCode)}</span>
          {Number(transaction.unmatchedAmount) > 0 &&
          transaction.reconciliationStatus !== 'UNMATCHED' ? (
            <span className={styles.cellMeta}>{transaction.unmatchedAmount} unmatched</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (transaction) => (
        <StatusBadge kind="reconciliation" status={transaction.reconciliationStatus} />
      ),
    },
    {
      key: 'matches',
      header: 'Matches',
      render: (transaction) =>
        transaction.matches.length ? (
          <div className={styles.matchList}>
            {transaction.matches.map((match) => (
              <span key={match.id} className={styles.matchRow}>
                {match.payment.paymentNumber}:{' '}
                {formatMoney(match.matchedAmount, transaction.currencyCode)}
                {match.status === 'REVERSED' ? ' (reversed)' : null}
                {match.status === 'ACTIVE' && canUnmatch ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setReversing(match)}
                  >
                    Unmatch
                  </Button>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (transaction) =>
        canMatch &&
        transaction.transactionType === 'DEBIT' &&
        Number(transaction.unmatchedAmount) > 0 ? (
          <Button size="sm" onClick={() => setMatching(transaction)}>
            Match
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Card title="External Transactions" flush>
        <div className={styles.tabsWrap}>
          <Tabs
            tabs={[
              { id: 'unmatched', label: 'Unmatched', count: unmatched.length },
              { id: 'matched', label: 'Matched', count: matched.length },
              { id: 'all', label: 'All', count: transactions.length },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as TabId)}
          />
        </div>
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(transaction) => transaction.id}
          loading={loading}
          emptyMessage={
            tab === 'unmatched'
              ? 'No unmatched transactions — everything is reconciled.'
              : 'No transactions to show.'
          }
        />
      </Card>
      <MatchModal
        transaction={matching}
        payments={payments}
        onClose={() => setMatching(null)}
        onMatched={() => {
          setMatching(null);
          onChanged();
        }}
      />
      <ConfirmDialog
        open={reversing !== null}
        title="Reverse match"
        message={
          reversing
            ? `Unmatch ${reversing.payment.paymentNumber} (${reversing.matchedAmount})? The match history is retained.`
            : ''
        }
        confirmLabel="Unmatch"
        tone="danger"
        requireReason
        busy={busy}
        onConfirm={(reason) => void reverse(reason)}
        onCancel={() => setReversing(null)}
      />
    </>
  );
}
