'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
type Journal = {
  journalNumber: string;
  entryDate: string;
  sourceType: string;
  description: string;
  currencyCode: string;
  status: string;
  claim: { id: string; claimNumber: string };
  reversalOf?: { id: string; journalNumber: string };
  reversals: Array<{ id: string; journalNumber: string }>;
  lines: Array<{
    id: string;
    debitAmount: string;
    creditAmount: string;
    glAccount: { code: string; name: string };
  }>;
};
export default function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [journal, setJournal] = useState<Journal>();
  const [error, setError] = useState('');
  useEffect(() => {
    apiRequest<{ data: Journal }>(`/accounting/journals/${id}`)
      .then((r) => setJournal(r.data))
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <main className="workspace">
      <section>
        <Link href="/accounting">← Journals</Link>
        {error && <p role="alert">{error}</p>}
        {!journal && !error ? (
          <p>Loading journal…</p>
        ) : (
          journal && (
            <>
              <p className="eyebrow">
                {journal.sourceType.replaceAll('_', ' ')} · {journal.status}
              </p>
              <h1>{journal.journalNumber}</h1>
              <p>{journal.description}</p>
              <p>
                <Link href={`/claims/${journal.claim.id}`}>{journal.claim.claimNumber}</Link> ·{' '}
                {new Date(journal.entryDate).toLocaleDateString()} · {journal.currencyCode}
              </p>
              {journal.reversalOf && (
                <p>
                  Reverses{' '}
                  <Link href={`/accounting/${journal.reversalOf.id}`}>
                    {journal.reversalOf.journalNumber}
                  </Link>
                </p>
              )}
              {journal.reversals.map((r) => (
                <p key={r.id}>
                  Reversed by <Link href={`/accounting/${r.id}`}>{r.journalNumber}</Link>
                </p>
              ))}
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.glAccount.code} — {l.glAccount.name}
                      </td>
                      <td>{l.debitAmount}</td>
                      <td>{l.creditAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        )}
      </section>
    </main>
  );
}
