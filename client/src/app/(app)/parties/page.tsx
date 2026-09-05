'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { enumLabel } from '@/lib/format';
import type { Party } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input } from '@/components/ui/form';
import { FilterBar, FilterItem } from '@/components/ui/filter-bar';
import { Pill } from '@/components/ui/status-badge';

const COLUMNS: Column<Party>[] = [
  { key: 'displayName', header: 'Name' },
  {
    key: 'partyType',
    header: 'Type',
    render: (party) => (
      <Pill tone={party.partyType === 'ORGANIZATION' ? 'info' : 'neutral'}>
        {enumLabel(party.partyType ?? '')}
      </Pill>
    ),
  },
  { key: 'email', header: 'Email', render: (party) => party.email || '—' },
  { key: 'phone', header: 'Phone', render: (party) => party.phone || '—' },
];

export default function PartiesPage() {
  const [query, setQuery] = useState('');
  const [parties, setParties] = useState<Party[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiRequest<{ data: Party[] }>(`/parties?q=${encodeURIComponent(query)}&limit=50`)
        .then((response) => {
          setParties(response.data);
          setError('');
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Parties could not load.'),
        );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <>
      <PageHeader
        title="Parties"
        subtitle="Insured parties and payees. New parties are added from the claim and payable forms."
      />
      <Card>
        <FilterBar>
          <FilterItem grow>
            <Input
              type="search"
              placeholder="Search parties by name…"
              aria-label="Search parties"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </FilterItem>
        </FilterBar>
      </Card>
      {error ? <p role="alert">{error}</p> : null}
      <Card flush>
        <DataTable
          columns={COLUMNS}
          rows={parties ?? []}
          rowKey={(party) => party.id}
          loading={parties === undefined && !error}
          emptyMessage="No parties match the search. The register shows up to 50 results — refine the search to find more."
        />
      </Card>
    </>
  );
}
