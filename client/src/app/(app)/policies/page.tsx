'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Policy } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input } from '@/components/ui/form';
import { FilterBar, FilterItem } from '@/components/ui/filter-bar';

const COLUMNS: Column<Policy>[] = [
  { key: 'policyNumber', header: 'Policy No.', nowrap: true },
  { key: 'policyName', header: 'Policy Name', render: (policy) => policy.policyName || '—' },
  {
    key: 'insured',
    header: 'Insured',
    render: (policy) => policy.insuredParty?.displayName ?? '—',
  },
  { key: 'currencyCode', header: 'Currency', nowrap: true },
  {
    key: 'effective',
    header: 'Effective',
    nowrap: true,
    render: (policy) =>
      policy.effectiveFrom || policy.effectiveTo
        ? `${formatDate(policy.effectiveFrom)} – ${formatDate(policy.effectiveTo)}`
        : '—',
  },
];

export default function PoliciesPage() {
  const [query, setQuery] = useState('');
  const [policies, setPolicies] = useState<Policy[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiRequest<{ data: Policy[] }>(`/policies?q=${encodeURIComponent(query)}&limit=50`)
        .then((response) => {
          setPolicies(response.data);
          setError('');
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Policies could not load.'),
        );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <>
      <PageHeader
        title="Policies"
        subtitle="Policies available for claim registration. New policies are added from the Create Claim form."
      />
      <Card
        title="Policy directory"
        subtitle="Search the reference policies available for claim registration."
        flush
      >
        <div style={{ padding: 20 }}>
          <FilterBar>
            <FilterItem grow>
              <Input
                type="search"
                placeholder="Search by policy number, name, or insured…"
                aria-label="Search policies"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </FilterItem>
          </FilterBar>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <DataTable
          columns={COLUMNS}
          rows={policies ?? []}
          rowKey={(policy) => policy.id}
          loading={policies === undefined && !error}
          emptyMessage="No policies match the search. The register shows up to 50 results — refine the search to find more."
        />
      </Card>
    </>
  );
}
