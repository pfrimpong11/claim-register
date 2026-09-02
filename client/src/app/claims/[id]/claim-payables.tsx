'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest, readCookie } from '@/lib/api';

type Party = { id: string; displayName: string };
type Journal = {
  journalNumber: string;
  lines: Array<{ glAccount: { name: string }; debitAmount: string; creditAmount: string }>;
};
type Payable = {
  id: string;
  amount: string;
  currencyCode: string;
  status: string;
  description?: string;
  payee: Party;
  journal?: Journal;
};

export function ClaimPayables({ claimId, onChanged }: { claimId: string; onChanged: () => void }) {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await apiRequest<{ data: Payable[] }>(`/claims/${claimId}/payables`);
    setPayables(result.data);
  }, [claimId]);
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([
        load(),
        apiRequest<{ data: Party[] }>('/parties?q=&limit=50').then((r) => setParties(r.data)),
      ]);
    };
    initialize().catch((e) => setError(e.message));
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await mutate(`/claims/${claimId}/payables`, {
        payeePartyId: form.get('payeePartyId'),
        amount: form.get('amount'),
        description: form.get('description') || null,
      });
      event.currentTarget.reset();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create payable.');
    } finally {
      setBusy(false);
    }
  }
  async function transition(id: string, action: 'approve' | 'cancel') {
    const reason =
      action === 'cancel' ? window.prompt('Why is this draft being cancelled?') : undefined;
    if (action === 'cancel' && !reason) return;
    setBusy(true);
    setError('');
    try {
      await mutate(`/payables/${id}/${action}`, action === 'cancel' ? { reason } : undefined);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to ${action} payable.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="documents-section">
      <h2>Indemnity payables</h2>
      {error && <p role="alert">{error}</p>}
      <form className="document-form" onSubmit={submit}>
        <label>
          Payee
          <select name="payeePartyId" required>
            <option value="">Select a payee</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input name="amount" inputMode="decimal" pattern="\d+(\.\d{1,4})?" required />
        </label>
        <label>
          Description
          <input name="description" maxLength={500} />
        </label>
        <button disabled={busy}>Create draft payable</button>
      </form>
      {payables.length === 0 ? (
        <p>No payables have been recorded.</p>
      ) : (
        <ul className="document-list">
          {payables.map((p) => (
            <li key={p.id}>
              <div>
                <strong>
                  {p.currencyCode} {p.amount} — {p.payee.displayName}
                </strong>
                <br />
                <span>{p.status}</span>
                {p.description && <p>{p.description}</p>}
                {p.journal && (
                  <div>
                    <small>Journal {p.journal.journalNumber}</small>
                    <ul>
                      {p.journal.lines.map((line) => (
                        <li key={`${line.glAccount.name}-${line.debitAmount}-${line.creditAmount}`}>
                          {line.glAccount.name}: debit {line.debitAmount}, credit{' '}
                          {line.creditAmount}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {p.status === 'DRAFT' && (
                <div className="document-actions">
                  <button disabled={busy} type="button" onClick={() => transition(p.id, 'approve')}>
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    className="secondary"
                    type="button"
                    onClick={() => transition(p.id, 'cancel')}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
async function mutate(path: string, body?: unknown) {
  return apiRequest(path, {
    method: 'POST',
    headers: { 'X-CSRF-Token': readCookie('claims_csrf') ?? '' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
