'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest, readCookie } from '@/lib/api';

type Account = {
  id: string;
  name: string;
  accountType: string;
  currencyCode: string;
  maskedIdentifier: string;
};
type Journal = { journalNumber: string; sourceType: string };
type Payment = {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  paymentAmount: string;
  paymentCurrencyCode: string;
  fxRate: string;
  settlementAmount: string;
  settlementCurrencyCode: string;
  status: string;
  reconciliationStatus: string;
  reconciliationMatchedAmount: string;
  reconciliationUnmatchedAmount: string;
  settlementAccount: Account;
  journals?: Journal[];
};

export function PayablePayments({
  payableId,
  onChanged,
}: {
  payableId: string;
  onChanged: () => void;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await apiRequest<{ data: Payment[] }>(`/payables/${payableId}/payments`);
    setPayments(result.data);
  }, [payableId]);
  useEffect(() => {
    const initialize = async () =>
      Promise.all([
        load(),
        apiRequest<{ data: Account[] }>('/settlement-accounts').then((r) => setAccounts(r.data)),
      ]);
    initialize().catch((e) => setError(e.message));
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await mutate(`/payables/${payableId}/payments`, {
        paymentDate: form.get('paymentDate'),
        paymentAmount: form.get('paymentAmount'),
        paymentCurrencyCode: form.get('paymentCurrencyCode'),
        fxRate: form.get('fxRate'),
        settlementAccountId: form.get('settlementAccountId'),
        reference: form.get('reference') || null,
      });
      event.currentTarget.reset();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create payment.');
    } finally {
      setBusy(false);
    }
  }
  async function transition(payment: Payment, action: 'approve' | 'mark-successful' | 'reverse') {
    const reason =
      action === 'reverse' ? window.prompt('Why is this payment being reversed?') : undefined;
    if (action === 'reverse' && !reason) return;
    setBusy(true);
    setError('');
    try {
      await mutate(
        `/payments/${payment.id}/${action}`,
        action === 'reverse' ? { reason } : undefined,
      );
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to ${action} payment.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <h4>Payments</h4>
      {error && <p role="alert">{error}</p>}
      <form className="document-form" onSubmit={create}>
        <label>
          Date
          <input type="date" name="paymentDate" required />
        </label>
        <label>
          Payment amount
          <input name="paymentAmount" inputMode="decimal" required />
        </label>
        <label>
          Payment currency
          <select name="paymentCurrencyCode" required>
            <option value="">Select</option>
            {[...new Set(accounts.map((a) => a.currencyCode))].map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          FX rate
          <input name="fxRate" inputMode="decimal" defaultValue="1" required />
          <small>1 payment-currency unit equals this many claim-currency units.</small>
        </label>
        <label>
          Settlement account
          <select name="settlementAccountId" required>
            <option value="">Select</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currencyCode}, {a.accountType.replaceAll('_', ' ')})
              </option>
            ))}
          </select>
        </label>
        <label>
          Reference
          <input name="reference" maxLength={200} />
        </label>
        <button disabled={busy}>Create payment draft</button>
      </form>
      {payments.length === 0 ? (
        <p>No payments recorded.</p>
      ) : (
        <ul>
          {payments.map((p) => (
            <li key={p.id}>
              <strong>
                {p.paymentNumber}: {p.paymentCurrencyCode} {p.paymentAmount}
              </strong>{' '}
              × {p.fxRate} = {p.settlementCurrencyCode} {p.settlementAmount} — {p.status} via{' '}
              {p.settlementAccount.name}
              {p.status === 'SUCCESSFUL' ? (
                <span>
                  {' '}
                  · Reconciliation: {p.reconciliationStatus.replaceAll('_', ' ')} (
                  {p.paymentCurrencyCode} {p.reconciliationUnmatchedAmount} unmatched)
                </span>
              ) : null}
              {p.journals?.map((j) => (
                <span key={j.journalNumber}>
                  {' '}
                  · {j.sourceType.replaceAll('_', ' ')} {j.journalNumber}
                </span>
              ))}
              <div className="document-actions">
                {p.status === 'DRAFT' && (
                  <button disabled={busy} type="button" onClick={() => transition(p, 'approve')}>
                    Approve
                  </button>
                )}
                {['APPROVED', 'PROCESSING'].includes(p.status) && (
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => transition(p, 'mark-successful')}
                  >
                    Mark successful
                  </button>
                )}
                {p.status === 'SUCCESSFUL' && (
                  <button
                    disabled={busy}
                    className="secondary"
                    type="button"
                    onClick={() => transition(p, 'reverse')}
                  >
                    Reverse
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
async function mutate(path: string, body?: unknown) {
  return apiRequest(path, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': readCookie('claims_csrf') ?? '',
      'Idempotency-Key': crypto.randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
