'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
type Entry = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  occurredAt: string;
  correlationId: string;
  actor?: { firstName: string; lastName: string };
};
export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const load = (value = '') =>
    apiRequest<{ data: Entry[] }>(`/audit-logs?${value}`)
      .then((result) => setEntries(result.data))
      .catch((e) => setError(e.message));
  useEffect(() => {
    apiRequest<{ data: Entry[] }>('/audit-logs')
      .then((result) => setEntries(result.data))
      .catch((e) => setError(e.message));
  }, []);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(query ? `action=${encodeURIComponent(query)}` : '');
  }
  return (
    <main className="workspace">
      <section className="wide">
        <Link href="/dashboard">← Dashboard</Link>
        <p className="eyebrow">Governance</p>
        <h1>Audit trail</h1>
        <form onSubmit={filter} className="toolbar">
          <label>
            Action contains <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button>Filter</button>
        </form>
        {error && <p role="alert">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When / actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {new Date(entry.occurredAt).toLocaleString()}
                    <br />
                    {entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : 'System'}
                  </td>
                  <td>{entry.action.replaceAll('_', ' ')}</td>
                  <td>
                    {entry.entityType}
                    <br />
                    <small>{entry.entityId}</small>
                  </td>
                  <td>
                    <details>
                      <summary>View masked data</summary>
                      <pre>
                        {JSON.stringify(
                          { before: entry.oldValues, after: entry.newValues },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entries.length && !error && <p>No audit events found.</p>}
      </section>
    </main>
  );
}
