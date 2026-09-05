'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Decimal from 'decimal.js';
import { apiMutate, apiRequest } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import { formatAmount, formatDate } from '@/lib/format';
import type { Claim, SettlementAccount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DateInput, Field, FormGrid, Input, Select, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { Money, StatRow, SummaryStat } from '@/components/ui/stats';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';
import { useClaimPayments, type PaymentWithPayable } from './use-claim-payments';
import styles from './claim-tabs.module.css';

type PendingAction = {
  type: 'approve' | 'mark-successful' | 'reverse';
  payment: PaymentWithPayable;
} | null;

const ACTION_LABELS: Record<string, string> = {
  approve: 'Approve payment',
  'mark-successful': 'Mark payment successful',
  reverse: 'Reverse payment',
};

export function PaymentsTab({ claim, onChanged }: { claim: Claim; onChanged: () => void }) {
  const toast = useToast();
  const canCreate = usePermission('payments.create');
  const canApprove = usePermission('payments.approve');
  const canSucceed = usePermission('payments.succeed');
  const canReverse = usePermission('payments.reverse');
  const { payables, payments, loading, error, reload } = useClaimPayments(claim.id);
  const [accounts, setAccounts] = useState<SettlementAccount[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [draft, setDraft] = useState({
    payableId: '',
    paymentAmount: '',
    paymentCurrencyCode: '',
    fxRate: '1',
  });

  useEffect(() => {
    apiRequest<{ data: SettlementAccount[] }>('/settlement-accounts')
      .then((response) => setAccounts(response.data))
      .catch(() => setAccounts([]));
  }, []);

  const approvedPayables = useMemo(
    () => payables.filter((payable) => payable.status === 'APPROVED'),
    [payables],
  );

  const currencyOptions = useMemo(
    () =>
      [...new Set(accounts.map((account) => account.currencyCode))].map((code) => ({
        value: code,
        label: code,
      })),
    [accounts],
  );

  const selectedPayable = approvedPayables.find((payable) => payable.id === draft.payableId);
  const selectedPaid = useMemo(() => {
    if (!selectedPayable) return new Decimal(0);
    return payments
      .filter(
        (payment) => payment.payable.id === selectedPayable.id && payment.status === 'SUCCESSFUL',
      )
      .reduce((total, payment) => total.plus(payment.settlementAmount), new Decimal(0));
  }, [payments, selectedPayable]);
  const selectedOutstanding = useMemo(
    () =>
      selectedPayable
        ? Decimal.max(new Decimal(selectedPayable.amount).minus(selectedPaid), 0)
        : new Decimal(0),
    [selectedPaid, selectedPayable],
  );
  const settlementPreview = useMemo(() => {
    try {
      return new Decimal(draft.paymentAmount || 0).times(draft.fxRate || 0);
    } catch {
      return new Decimal(0);
    }
  }, [draft.paymentAmount, draft.fxRate]);
  const potentialOverpayment = useMemo(() => {
    return Decimal.max(settlementPreview.minus(selectedOutstanding), 0);
  }, [settlementPreview, selectedOutstanding]);
  const remainingAfterPayment = Decimal.max(selectedOutstanding.minus(settlementPreview), 0);
  const requiredPaymentAmount = useMemo(() => {
    try {
      const rate = new Decimal(draft.fxRate || 0);
      return rate.gt(0) ? selectedOutstanding.dividedBy(rate) : null;
    } catch {
      return null;
    }
  }, [draft.fxRate, selectedOutstanding]);

  function successfulOverpayment(payment: PaymentWithPayable) {
    const paid = payments
      .filter(
        (candidate) =>
          candidate.id !== payment.id &&
          candidate.payable.id === payment.payable.id &&
          candidate.status === 'SUCCESSFUL',
      )
      .reduce((total, candidate) => total.plus(candidate.settlementAmount), new Decimal(0));
    const outstanding = Decimal.max(new Decimal(payment.payable.amount).minus(paid), 0);
    return Decimal.max(new Decimal(payment.settlementAmount).minus(outstanding), 0);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await apiMutate(`/payables/${form.get('payableId')}/payments`, {
        idempotent: true,
        body: {
          paymentDate: form.get('paymentDate'),
          paymentAmount: form.get('paymentAmount'),
          paymentCurrencyCode: form.get('paymentCurrencyCode'),
          fxRate: form.get('fxRate'),
          settlementAccountId: form.get('settlementAccountId'),
          reference: form.get('reference') || null,
          confirmOverpayment: form.get('confirmOverpayment') === 'on',
          overpaymentReason: form.get('overpaymentReason') || undefined,
        },
      });
      setCreateOpen(false);
      setDraft({ payableId: '', paymentAmount: '', paymentCurrencyCode: '', fxRate: '1' });
      toast.success('Payment draft created.');
      await reload();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to create payment.');
      await reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function runPending(reason?: string) {
    if (!pending) return;
    setBusy(true);
    try {
      const excess =
        pending.type === 'mark-successful'
          ? successfulOverpayment(pending.payment)
          : new Decimal(0);
      await apiMutate(`/payments/${pending.payment.id}/${pending.type}`, {
        idempotent: true,
        body:
          pending.type === 'reverse'
            ? { reason }
            : pending.type === 'mark-successful' && excess.gt(0)
              ? { confirmOverpayment: true, overpaymentReason: reason }
              : undefined,
      });
      toast.success(`${ACTION_LABELS[pending.type]} completed.`);
      setPending(null);
      await reload();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The action could not be completed.');
      await reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<PaymentWithPayable>[] = [
    { key: 'paymentNumber', header: 'Payment No.', nowrap: true },
    { key: 'payee', header: 'Payee', render: (payment) => payment.payable.payee.displayName },
    {
      key: 'paymentDate',
      header: 'Payment Date',
      nowrap: true,
      render: (payment) => formatDate(payment.paymentDate),
    },
    {
      key: 'paymentAmount',
      header: 'Payment Amount',
      align: 'right',
      render: (payment) => <Money amount={payment.paymentAmount} />,
    },
    { key: 'paymentCurrencyCode', header: 'Currency', nowrap: true },
    {
      key: 'fxRate',
      header: 'FX Rate',
      align: 'right',
      render: (payment) => payment.fxRate,
    },
    {
      key: 'settlementAmount',
      header: `Settlement (${claim.currencyCode})`,
      align: 'right',
      render: (payment) => <Money amount={payment.settlementAmount} />,
    },
    {
      key: 'overpaymentAmount',
      header: 'Overpaid',
      align: 'right',
      render: (payment) => (
        <Money
          amount={payment.overpaymentAmount || '0'}
          tone={Number(payment.overpaymentAmount || 0) > 0 ? 'danger' : undefined}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment) => <StatusBadge kind="payment" status={payment.status} />,
    },
    {
      key: 'reconciled',
      header: 'Reconciled',
      render: (payment) =>
        payment.status === 'SUCCESSFUL' ? (
          <StatusBadge
            kind="boolean"
            status={payment.reconciliationStatus === 'MATCHED' ? 'YES' : 'NO'}
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (payment) => (
        <div className={styles.actionsCell}>
          {payment.status === 'DRAFT' && canApprove ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setPending({ type: 'approve', payment })}
            >
              Approve
            </Button>
          ) : null}
          {['APPROVED', 'PROCESSING'].includes(payment.status) && canSucceed ? (
            <Button
              size="sm"
              icon="check"
              disabled={busy}
              onClick={() => setPending({ type: 'mark-successful', payment })}
            >
              Mark successful
            </Button>
          ) : null}
          {payment.status === 'SUCCESSFUL' && canReverse ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setPending({ type: 'reverse', payment })}
            >
              Reverse
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.stack}>
      <StatRow>
        <SummaryStat
          label="Approved Indemnity"
          value={<Money amount={claim.approvedAmount} currency={claim.currencyCode} />}
        />
        {new Decimal(claim.overpaidAmount || 0).gt(0) ? (
          <SummaryStat
            label="Overpaid"
            value={<Money amount={claim.overpaidAmount || '0'} currency={claim.currencyCode} />}
            tone="danger"
          />
        ) : null}
        <SummaryStat
          label="Total Paid"
          value={<Money amount={claim.paidAmount} currency={claim.currencyCode} />}
          tone="success"
        />
        <SummaryStat
          label="Outstanding"
          value={<Money amount={claim.outstandingAmount} currency={claim.currencyCode} />}
          tone={Number(claim.outstandingAmount) > 0 ? 'danger' : 'success'}
        />
      </StatRow>
      <Card
        title="Payments"
        subtitle="Payments settle approved indemnity payables, including cross-currency settlements."
        actions={
          canCreate ? (
            <Button
              icon="plus"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={approvedPayables.length === 0}
              title={
                approvedPayables.length === 0 ? 'An approved payable is required first.' : undefined
              }
            >
              New Payment
            </Button>
          ) : undefined
        }
        flush
      >
        {error ? <p role="alert">{error}</p> : null}
        <DataTable
          columns={columns}
          rows={payments}
          rowKey={(payment) => payment.id}
          loading={loading && !error}
          emptyMessage="No payments recorded."
        />
      </Card>
      <Modal open={createOpen} title="New Payment" onClose={() => setCreateOpen(false)} size="lg">
        <form onSubmit={create} className={styles.formStack}>
          <Field label="Payable" htmlFor="payment-payable" required>
            <Select
              id="payment-payable"
              name="payableId"
              value={draft.payableId}
              onChange={(event) =>
                setDraft((value) => ({ ...value, payableId: event.target.value }))
              }
              required
              placeholder="Select an approved payable"
              options={approvedPayables.map((payable) => ({
                value: payable.id,
                label: `${payable.payee.displayName} — ${payable.currencyCode} ${payable.amount}`,
              }))}
            />
          </Field>
          <FormGrid>
            <Field label="Payment Date" htmlFor="payment-date" required>
              <DateInput id="payment-date" name="paymentDate" required />
            </Field>
            <Field label="Payment Amount" htmlFor="payment-amount" required>
              <Input
                id="payment-amount"
                name="paymentAmount"
                value={draft.paymentAmount}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, paymentAmount: event.target.value }))
                }
                inputMode="decimal"
                pattern="\d+(\.\d{1,4})?"
                required
              />
            </Field>
            <Field label="Payment Currency" htmlFor="payment-currency" required>
              <Select
                id="payment-currency"
                name="paymentCurrencyCode"
                value={draft.paymentCurrencyCode}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    paymentCurrencyCode: event.target.value,
                    fxRate: event.target.value === claim.currencyCode ? '1' : value.fxRate,
                  }))
                }
                required
                placeholder="Select"
                options={currencyOptions}
              />
            </Field>
            <Field
              label="FX Rate"
              htmlFor="payment-fx"
              required
              hint={`1 payment-currency unit equals this many ${claim.currencyCode}.`}
            >
              <Input
                id="payment-fx"
                name="fxRate"
                inputMode="decimal"
                value={draft.fxRate}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, fxRate: event.target.value }))
                }
                required
              />
            </Field>
          </FormGrid>
          {selectedPayable ? (
            <section className={styles.paymentImpact} aria-live="polite">
              <strong>Payment impact</strong>
              <dl className={styles.paymentImpactGrid}>
                <div>
                  <dt>Payable approved</dt>
                  <dd>
                    {claim.currencyCode} {formatAmount(selectedPayable.amount)}
                  </dd>
                </div>
                <div>
                  <dt>Already successfully paid</dt>
                  <dd>
                    {claim.currencyCode} {formatAmount(selectedPaid.toFixed(4))}
                  </dd>
                </div>
                <div>
                  <dt>Selected payable outstanding</dt>
                  <dd>
                    {claim.currencyCode} {formatAmount(selectedOutstanding.toFixed(4))}
                  </dd>
                </div>
                <div>
                  <dt>Entire claim outstanding</dt>
                  <dd>
                    {claim.currencyCode} {formatAmount(claim.outstandingAmount)}
                  </dd>
                </div>
                {draft.paymentCurrencyCode && requiredPaymentAmount ? (
                  <div>
                    <dt>Amount required to settle</dt>
                    <dd>
                      {draft.paymentCurrencyCode} {formatAmount(requiredPaymentAmount.toFixed(4))}
                    </dd>
                  </div>
                ) : null}
                {draft.paymentAmount ? (
                  <div>
                    <dt>Settlement value</dt>
                    <dd>
                      {claim.currencyCode} {formatAmount(settlementPreview.toFixed(4))}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {draft.paymentAmount ? (
                <p
                  className={
                    potentialOverpayment.gt(0)
                      ? styles.impactDanger
                      : remainingAfterPayment.eq(0)
                        ? styles.impactSuccess
                        : styles.impactNeutral
                  }
                >
                  {potentialOverpayment.gt(0)
                    ? `This will record a ${claim.currencyCode} ${formatAmount(potentialOverpayment.toFixed(4))} overpayment.`
                    : remainingAfterPayment.eq(0)
                      ? 'This payment will fully settle the selected payable.'
                      : `${claim.currencyCode} ${formatAmount(remainingAfterPayment.toFixed(4))} will remain outstanding on the selected payable.`}
                </p>
              ) : null}
            </section>
          ) : null}
          <Field label="Settlement Account" htmlFor="payment-account" required>
            <Select
              id="payment-account"
              name="settlementAccountId"
              required
              placeholder="Select"
              options={accounts.map((account) => ({
                value: account.id,
                label: `${account.name} (${account.currencyCode})`,
              }))}
            />
          </Field>
          <Field label="Reference" htmlFor="payment-reference">
            <Input id="payment-reference" name="reference" maxLength={200} />
          </Field>
          {selectedPayable && potentialOverpayment.gt(0) ? (
            <div className={styles.overpaymentWarning} role="alert">
              <strong>Potential overpayment</strong>
              <p>
                This payment exceeds the payable&apos;s current outstanding indemnity by{' '}
                {claim.currencyCode} {potentialOverpayment.toFixed(2)}. Confirm only if this amount
                was genuinely transferred outside the system.
              </p>
              <label className={styles.confirmationRow}>
                <input type="checkbox" name="confirmOverpayment" required />I confirm this is an
                intentional record of an external overpayment.
              </label>
              <Field label="Reason for overpayment" htmlFor="payment-overpayment-reason" required>
                <Textarea
                  id="payment-overpayment-reason"
                  name="overpaymentReason"
                  minLength={5}
                  maxLength={500}
                  required
                />
              </Field>
            </div>
          ) : null}
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create Draft
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={pending !== null && pending.type !== 'reverse'}
        title={pending ? ACTION_LABELS[pending.type] : ''}
        message={
          pending
            ? pending.type === 'mark-successful' && successfulOverpayment(pending.payment).gt(0)
              ? `${pending.payment.paymentNumber} exceeds the current outstanding indemnity by ${claim.currencyCode} ${successfulOverpayment(pending.payment).toFixed(2)}. Confirm only if the external transfer occurred.`
              : `${ACTION_LABELS[pending.type]} ${pending.payment.paymentNumber} (${pending.payment.paymentCurrencyCode} ${pending.payment.paymentAmount})?`
            : ''
        }
        confirmLabel="Confirm"
        tone={
          pending?.type === 'mark-successful' && successfulOverpayment(pending.payment).gt(0)
            ? 'danger'
            : 'primary'
        }
        requireReason={
          pending?.type === 'mark-successful' && successfulOverpayment(pending.payment).gt(0)
        }
        reasonLabel="Reason for recording this overpayment"
        busy={busy}
        onConfirm={(reason) => void runPending(reason)}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.type === 'reverse'}
        title="Reverse payment"
        message={
          pending
            ? `Reverse ${pending.payment.paymentNumber}? A reversal journal will be posted and the outstanding balance restored.`
            : ''
        }
        confirmLabel="Reverse"
        tone="danger"
        requireReason
        busy={busy}
        onConfirm={(reason) => void runPending(reason)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
