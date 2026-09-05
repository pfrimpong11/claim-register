'use client';

import { useMemo, useState } from 'react';
import { apiMutate } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { ExternalTransaction, ReconciliationPayment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import styles from './reconciliation.module.css';

export function MatchModal({
  transaction,
  payments,
  onClose,
  onMatched,
}: {
  transaction: ExternalTransaction | null;
  payments: ReconciliationPayment[];
  onClose: () => void;
  onMatched: () => void;
}) {
  const toast = useToast();
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const compatible = useMemo(
    () =>
      transaction
        ? payments.filter(
            (payment) =>
              payment.settlementAccount.id === transaction.settlementAccount.id &&
              payment.paymentCurrencyCode === transaction.currencyCode &&
              Number(payment.unmatchedAmount) > 0,
          )
        : [],
    [payments, transaction],
  );

  function reset() {
    setPaymentId('');
    setAmount('');
    setNotes('');
  }

  function close() {
    reset();
    onClose();
  }

  function selectPayment(id: string) {
    setPaymentId(id);
    const payment = compatible.find((item) => item.id === id);
    if (payment && transaction) {
      const suggestion = Math.min(
        Number(payment.unmatchedAmount),
        Number(transaction.unmatchedAmount),
      );
      setAmount(String(suggestion));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transaction) return;
    setBusy(true);
    try {
      await apiMutate('/reconciliation-matches', {
        idempotent: true,
        body: {
          paymentId,
          externalTransactionId: transaction.id,
          matchedAmount: amount,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      toast.success('Payment matched.');
      reset();
      onMatched();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Match failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={transaction !== null} title="Match Payment" onClose={close}>
      {transaction ? (
        <form onSubmit={submit} className={styles.formStack}>
          <div className={styles.cellStack}>
            <span>
              {transaction.externalReference} ·{' '}
              {formatMoney(transaction.amount, transaction.currencyCode)}
            </span>
            <span className={styles.cellMeta}>
              {transaction.settlementAccount.name} · {transaction.unmatchedAmount} unmatched
            </span>
          </div>
          <Field
            label="Successful Payment"
            htmlFor="match-payment"
            required
            hint={
              compatible.length === 0
                ? 'No compatible unmatched payments for this account and currency.'
                : undefined
            }
          >
            <Select
              id="match-payment"
              required
              value={paymentId}
              onChange={(event) => selectPayment(event.target.value)}
              placeholder="Select payment"
              options={compatible.map((payment) => ({
                value: payment.id,
                label: `${payment.paymentNumber} · ${payment.paymentCurrencyCode} ${payment.unmatchedAmount} unmatched · ${payment.payable.claim.claimNumber}`,
              }))}
            />
          </Field>
          <Field label="Match Amount" htmlFor="match-amount" required>
            <Input
              id="match-amount"
              required
              inputMode="decimal"
              pattern="\d+(\.\d{1,4})?"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field label="Notes" htmlFor="match-notes">
            <Input
              id="match-notes"
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!paymentId}>
              Match
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
