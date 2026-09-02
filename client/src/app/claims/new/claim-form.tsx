'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, readCookie } from '@/lib/api';
type Party = { id: string; displayName: string };
type Policy = {
  id: string;
  policyNumber: string;
  policyName?: string;
  currencyCode: string;
  insuredParty: Party;
};
export function ClaimForm() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState('');
  const load = () =>
    Promise.all([
      apiRequest<{ data: Policy[] }>('/policies'),
      apiRequest<{ data: Party[] }>('/parties'),
    ]).then(([p, a]) => {
      setPolicies(p.data);
      setParties(a.data);
    });
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const post = async <T,>(path: string, body: unknown) =>
    apiRequest<{ data: T }>(path, {
      method: 'POST',
      headers: { 'X-CSRF-Token': readCookie('claims_csrf') ?? '' },
      body: JSON.stringify(body),
    });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const r = await post<{ id: string }>('/claims', {
        policyId: f.get('policyId'),
        lossDate: f.get('lossDate'),
        notificationDate: f.get('notificationDate'),
        lossNature: f.get('lossNature'),
        description: f.get('description') || null,
        estimatedLossAmount: f.get('amount'),
      });
      router.push(`/claims/${r.data.id}`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Unable to create claim.');
    }
  }
  async function addParty(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await post<Party>('/parties', {
      partyType: f.get('partyType'),
      displayName: f.get('displayName'),
      email: null,
      phone: null,
    });
    await load();
  }
  async function addPolicy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await post<Policy>('/policies', {
      policyNumber: f.get('policyNumber'),
      policyName: f.get('policyName') || null,
      insuredPartyId: f.get('insuredPartyId'),
      currencyCode: f.get('currencyCode'),
      effectiveFrom: null,
      effectiveTo: null,
    });
    await load();
  }
  return (
    <section>
      <p className="eyebrow">New claim</p>
      <h1>Register claim</h1>
      {error && <p role="alert">{error}</p>}
      <form className="auth-form" onSubmit={submit}>
        <label>
          Policy
          <select name="policyId" required>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.policyNumber} — {p.insuredParty.displayName} ({p.currencyCode})
              </option>
            ))}
          </select>
        </label>
        <label>
          Loss date
          <input name="lossDate" type="date" required />
        </label>
        <label>
          Notification date
          <input name="notificationDate" type="date" required />
        </label>
        <label>
          Nature of loss
          <input name="lossNature" required />
        </label>
        <label>
          Estimated loss
          <input name="amount" inputMode="decimal" required />
        </label>
        <label>
          Description
          <textarea name="description" />
        </label>
        <button>Register claim</button>
      </form>
      <details>
        <summary>Add party</summary>
        <form className="auth-form" onSubmit={addParty}>
          <select name="partyType">
            <option>PERSON</option>
            <option>ORGANIZATION</option>
          </select>
          <input name="displayName" placeholder="Name" required />
          <button>Add party</button>
        </form>
      </details>
      <details>
        <summary>Add policy</summary>
        <form className="auth-form" onSubmit={addPolicy}>
          <input name="policyNumber" placeholder="Policy number" required />
          <input name="policyName" placeholder="Policy name" />
          <select name="insuredPartyId">
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
          <select name="currencyCode">
            {['GHS', 'USD', 'EUR', 'GBP'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button>Add policy</button>
        </form>
      </details>
    </section>
  );
}
