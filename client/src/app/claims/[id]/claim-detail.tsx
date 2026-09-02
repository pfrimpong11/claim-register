'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { ClaimDocuments } from './claim-documents';
import { ClaimPayables } from './claim-payables';
type StatusEvent = { id: string; toStatus: string; changedAt: string };
type Claim = {
  claimNumber: string;
  financialStatus: string;
  policyNumberSnapshot: string;
  policyNameSnapshot?: string;
  insuredNameSnapshot: string;
  lossDate: string;
  lossNature: string;
  currencyCode: string;
  estimatedLossAmount: string;
  approvedAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  statusHistory: StatusEvent[];
};
export function ClaimDetail({ id }: { id: string }) {
  const [c, setC] = useState<Claim>();
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      apiRequest<{ data: Claim }>(`/claims/${id}`)
        .then((r) => setC(r.data))
        .catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <p role="alert">{error}</p>;
  if (!c) return <p>Loading claim…</p>;
  return (
    <section>
      <Link href="/claims">← Claims</Link>
      <p className="eyebrow">{c.financialStatus.replaceAll('_', ' ')}</p>
      <h1>{c.claimNumber}</h1>
      <dl className="detail-grid">
        <div>
          <dt>Policy</dt>
          <dd>
            {c.policyNumberSnapshot} — {c.policyNameSnapshot}
          </dd>
        </div>
        <div>
          <dt>Insured</dt>
          <dd>{c.insuredNameSnapshot}</dd>
        </div>
        <div>
          <dt>Loss</dt>
          <dd>
            {new Date(c.lossDate).toLocaleDateString()} — {c.lossNature}
          </dd>
        </div>
        <div>
          <dt>Initial reserve</dt>
          <dd>
            {c.currencyCode} {c.estimatedLossAmount}
          </dd>
        </div>
        <div>
          <dt>Approved / paid / outstanding</dt>
          <dd>
            {c.approvedAmount} / {c.paidAmount} / {c.outstandingAmount}
          </dd>
        </div>
      </dl>
      <ClaimPayables claimId={id} onChanged={load} />
      <ClaimDocuments claimId={id} />
      <h2>Activity</h2>
      <ul>
        {c.statusHistory.map((s) => (
          <li key={s.id}>
            {s.toStatus.replaceAll('_', ' ')} — {new Date(s.changedAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </section>
  );
}
