'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
type Entry = {
  id: string;
  action: string;
  occurredAt: string;
  actor?: { firstName: string; lastName: string };
};
export function ClaimAudit({ claimId }: { claimId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    apiRequest<{ data: Entry[] }>(`/audit-logs?entityId=${claimId}`)
      .then((result) => setEntries(result.data))
      .catch(() => undefined);
  }, [claimId]);
  if (!entries.length) return null;
  return (
    <>
      <h2>Audit trail</h2>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.action.replaceAll('_', ' ')} — {new Date(entry.occurredAt).toLocaleString()}{' '}
            {entry.actor ? `by ${entry.actor.firstName} ${entry.actor.lastName}` : ''}
          </li>
        ))}
      </ul>
    </>
  );
}
