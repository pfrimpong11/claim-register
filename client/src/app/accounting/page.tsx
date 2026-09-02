'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
type Journal = {
  id: string;
  journalNumber: string;
  entryDate: string;
  sourceType: string;
  description: string;
  currencyCode: string;
  claim: { id: string; claimNumber: string };
  lines: Array<{
    id: string;
    debitAmount: string;
    creditAmount: string;
    glAccount: { name: string };
  }>;
};
export default function AccountingPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    apiRequest<{ data: Journal[] }>('/accounting/journals')
      .then((r) => setJournals(r.data))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="workspace">
      <section className="wide">
        <Link href="/dashboard">← Dashboard</Link>
        <p className="eyebrow">Read-only general ledger</p>
        <h1>Accounting journals</h1>
        {error && <p role="alert">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Journal</th>
                <th>Date/source</th>
                <th>Claim</th>
                <th>Description</th>
                <th>Lines</th>
              </tr>
            </thead>
            <tbody>
              {journals.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link href={`/accounting/${j.id}`}>{j.journalNumber}</Link>
                  </td>
                  <td>
                    {new Date(j.entryDate).toLocaleDateString()}
                    <br />
                    {j.sourceType.replaceAll('_', ' ')}
                  </td>
                  <td>
                    <Link href={`/claims/${j.claim.id}`}>{j.claim.claimNumber}</Link>
                  </td>
                  <td>{j.description}</td>
                  <td>
                    {j.lines.map((l) => (
                      <div key={l.id}>
                        {l.glAccount.name}: {j.currencyCode} Dr {l.debitAmount} / Cr{' '}
                        {l.creditAmount}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {journals.length === 0 && !error && <p>No journals found.</p>}
      </section>
    </main>
  );
}
