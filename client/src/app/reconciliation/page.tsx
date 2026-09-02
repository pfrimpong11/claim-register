'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, readCookie } from '@/lib/api';

type Account = { id: string; name: string; accountType: string; currencyCode: string };
type Match = {
  id: string;
  matchedAmount: string;
  status: string;
  payment: { paymentNumber: string };
};
type Transaction = {
  id: string;
  externalReference: string;
  transactionDate: string;
  transactionType: string;
  amount: string;
  currencyCode: string;
  matchedAmount: string;
  unmatchedAmount: string;
  reconciliationStatus: string;
  sourceType: string;
  settlementAccount: Account;
  matches: Match[];
};
type Payment = {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  paymentAmount: string;
  paymentCurrencyCode: string;
  matchedAmount: string;
  unmatchedAmount: string;
  reconciliationStatus: string;
  reference?: string;
  settlementAccount: Account;
  payable: { claim: { id: string; claimNumber: string } };
};
type Import = {
  id: string;
  sourceFileName: string;
  status: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  failedRows: number;
  errorSummary?: Array<{ row: number | null; message: string }>;
  settlementAccount: Account;
};

export default function ReconciliationPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [imports, setImports] = useState<Import[]>([]);
  const [selectedPayment, setSelectedPayment] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [a, t, p, i] = await Promise.all([
        apiRequest<{ data: Account[] }>('/settlement-accounts'),
        apiRequest<{ data: Transaction[] }>('/external-transactions'),
        apiRequest<{ data: Payment[] }>('/reconciliation-payments'),
        apiRequest<{ data: Import[] }>('/transaction-imports'),
      ]);
      setAccounts(a.data);
      setTransactions(t.data);
      setPayments(p.data);
      setImports(i.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reconciliation.');
    }
  }, []);
  useEffect(() => {
    apiRequest<{ data: Account[] }>('/settlement-accounts')
      .then((result) => setAccounts(result.data))
      .catch((e) => setError(e.message));
    apiRequest<{ data: Transaction[] }>('/external-transactions')
      .then((result) => setTransactions(result.data))
      .catch((e) => setError(e.message));
    apiRequest<{ data: Payment[] }>('/reconciliation-payments')
      .then((result) => setPayments(result.data))
      .catch((e) => setError(e.message));
    apiRequest<{ data: Import[] }>('/transaction-imports')
      .then((result) => setImports(result.data))
      .catch((e) => setError(e.message));
  }, []);
  const compatibleTransactions = useMemo(() => {
    const payment = payments.find((item) => item.id === selectedPayment);
    return payment
      ? transactions.filter(
          (item) =>
            item.transactionType === 'DEBIT' &&
            item.settlementAccount.id === payment.settlementAccount.id &&
            item.currencyCode === payment.paymentCurrencyCode &&
            Number(item.unmatchedAmount) > 0,
        )
      : transactions;
  }, [payments, selectedPayment, transactions]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest('/transaction-imports', {
        method: 'POST',
        headers: { 'X-CSRF-Token': readCookie('claims_csrf') ?? '' },
        body: form,
      });
      event.currentTarget.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }
  async function match(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/reconciliation-matches', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          paymentId: selectedPayment,
          externalTransactionId: selectedTransaction,
          matchedAmount: amount,
        }),
      });
      setSelectedPayment('');
      setSelectedTransaction('');
      setAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Match failed.');
    } finally {
      setBusy(false);
    }
  }
  async function reverse(id: string) {
    const reason = window.prompt('Reason for unmatching (at least 5 characters)');
    if (!reason) return;
    setBusy(true);
    try {
      await apiRequest(`/reconciliation-matches/${id}/reverse`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unmatch failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace">
      <section className="wide">
        <Link href="/dashboard">← Dashboard</Link>
        <p className="eyebrow">Bank and mobile-money evidence</p>
        <h1>Reconciliation</h1>
        <p>
          Payment execution and reconciliation are tracked separately. Partial matches are
          supported.
        </p>
        {error && <p role="alert">{error}</p>}
        <h2>Import external transactions</h2>
        <form onSubmit={upload} className="form-grid">
          <label>
            Settlement account
            <select name="settlementAccountId" required>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currencyCode})
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select name="sourceType" required>
              <option value="BANK_STATEMENT">Bank statement</option>
              <option value="MOMO_STATEMENT">Mobile-money statement</option>
              <option value="GATEWAY_WEBHOOK">Gateway export</option>
              <option value="MANUAL_IMPORT">Manual import</option>
            </select>
          </label>
          <label>
            CSV file
            <input name="file" type="file" accept=".csv,text/csv" required />
          </label>
          <button disabled={busy}>Queue import</button>
        </form>
        <p>
          Columns: externalReference, transactionDate, valueDate, transactionType, amount,
          currencyCode, description
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Import</th>
                <th>Account</th>
                <th>Status</th>
                <th>Rows</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <td>{i.sourceFileName}</td>
                  <td>{i.settlementAccount.name}</td>
                  <td>{label(i.status)}</td>
                  <td>
                    {i.importedRows} imported · {i.duplicateRows} duplicates · {i.failedRows} failed
                    {i.errorSummary?.length ? (
                      <details>
                        <summary>Errors</summary>
                        {i.errorSummary.map((e, index) => (
                          <div key={index}>
                            Row {e.row ?? 'file'}: {e.message}
                          </div>
                        ))}
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2>Match payment evidence</h2>
        <form onSubmit={match} className="form-grid">
          <label>
            Successful payment
            <select
              required
              value={selectedPayment}
              onChange={(e) => {
                setSelectedPayment(e.target.value);
                setSelectedTransaction('');
              }}
            >
              <option value="">Select payment</option>
              {payments
                .filter((p) => Number(p.unmatchedAmount) > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.paymentNumber} · {p.paymentCurrencyCode} {p.unmatchedAmount} unmatched ·{' '}
                    {p.settlementAccount.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            External debit
            <select
              required
              value={selectedTransaction}
              onChange={(e) => setSelectedTransaction(e.target.value)}
            >
              <option value="">Select transaction</option>
              {compatibleTransactions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.externalReference} · {t.currencyCode} {t.unmatchedAmount} unmatched
                </option>
              ))}
            </select>
          </label>
          <label>
            Match amount
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button disabled={busy}>Match</button>
        </form>
        <h2>External transactions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Source/account</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Matches</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.externalReference}
                    <br />
                    {new Date(t.transactionDate).toLocaleDateString()}
                  </td>
                  <td>
                    {label(t.sourceType)}
                    <br />
                    {t.settlementAccount.name}
                  </td>
                  <td>
                    {t.currencyCode} {t.amount}
                    <br />
                    {t.unmatchedAmount} unmatched
                  </td>
                  <td>{label(t.reconciliationStatus)}</td>
                  <td>
                    {t.matches.map((m) => (
                      <div key={m.id}>
                        {m.payment.paymentNumber}: {t.currencyCode} {m.matchedAmount}{' '}
                        <button type="button" disabled={busy} onClick={() => void reverse(m.id)}>
                          Unmatch
                        </button>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2>Successful payments</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Payment</th>
                <th>Claim</th>
                <th>Account</th>
                <th>Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.paymentNumber}
                    <br />
                    {p.paymentCurrencyCode} {p.paymentAmount}
                  </td>
                  <td>
                    <Link href={`/claims/${p.payable.claim.id}`}>
                      {p.payable.claim.claimNumber}
                    </Link>
                  </td>
                  <td>{p.settlementAccount.name}</td>
                  <td>
                    {label(p.reconciliationStatus)}
                    <br />
                    {p.paymentCurrencyCode} {p.unmatchedAmount} unmatched
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
function headers() {
  return {
    'X-CSRF-Token': readCookie('claims_csrf') ?? '',
    'Idempotency-Key': crypto.randomUUID(),
  };
}
function label(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}
