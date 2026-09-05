'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useCurrentUser, usePermission } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import type { Claim, ClaimListResponse, ClaimSummary } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Money, StatRow, SummaryStat } from '@/components/ui/stats';
import { StatusBadge } from '@/components/ui/status-badge';

const RECENT_COLUMNS: Column<Claim>[] = [
  {
    key: 'claimNumber',
    header: 'Claim No.',
    render: (claim) => (
      <Link href={`/claims/${claim.id}`} className="text-link">
        {claim.claimNumber}
      </Link>
    ),
    nowrap: true,
  },
  {
    key: 'insured',
    header: 'Insured',
    render: (claim) => claim.insuredNameSnapshot ?? '—',
  },
  { key: 'lossNature', header: 'Loss Nature' },
  {
    key: 'lossDate',
    header: 'Loss Date',
    render: (claim) => formatDate(claim.lossDate),
    nowrap: true,
  },
  {
    key: 'estimatedLoss',
    header: 'Est. Loss',
    align: 'right',
    render: (claim) => <Money amount={claim.estimatedLossAmount} currency={claim.currencyCode} />,
  },
  {
    key: 'status',
    header: 'Status',
    render: (claim) => <StatusBadge kind="claim" status={claim.financialStatus} />,
  },
];

export function Dashboard() {
  const { user } = useCurrentUser();
  const canViewClaims = usePermission('claims.view');
  const canCreateClaims = usePermission('claims.create');
  const canReconcile = usePermission('reconciliation.view');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [summaries, setSummaries] = useState<ClaimSummary[]>([]);
  const [totalClaims, setTotalClaims] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewClaims) return;
    apiRequest<ClaimListResponse>('/claims?page=1&pageSize=5&sort=lossDate&direction=desc')
      .then((response) => {
        setClaims(response.data);
        setSummaries(response.summaries);
        setTotalClaims(response.meta.total);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'The dashboard could not load.');
      })
      .finally(() => setLoading(false));
  }, [canViewClaims]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={user ? `Welcome back, ${user.firstName}.` : undefined}
        actions={
          <>
            {canReconcile ? (
              <ButtonLink href="/reconciliation" variant="secondary" icon="reconciliation">
                Reconciliation
              </ButtonLink>
            ) : null}
            {canCreateClaims ? (
              <ButtonLink href="/claims/new" icon="plus">
                Create Claim
              </ButtonLink>
            ) : null}
          </>
        }
      />
      {error ? <p role="alert">{error}</p> : null}
      {canViewClaims ? (
        <>
          <StatRow>
            <SummaryStat
              label="Registered claims"
              value={loading ? '…' : totalClaims}
              hint="All currencies"
            />
            {summaries.map((summary) => (
              <SummaryStat
                key={summary.currencyCode}
                label={`Outstanding (${summary.currencyCode})`}
                value={<Money amount={summary.outstandingAmount} currency={summary.currencyCode} />}
                tone={Number(summary.outstandingAmount) > 0 ? 'danger' : 'success'}
                hint={`${summary.claimCount} claims · paid ${summary.paidAmount}`}
              />
            ))}
          </StatRow>
          <Card
            title="Recent claims"
            actions={
              <ButtonLink href="/claims" variant="ghost" size="sm">
                View all
              </ButtonLink>
            }
            flush
          >
            <DataTable
              columns={RECENT_COLUMNS}
              rows={claims}
              rowKey={(claim) => claim.id}
              loading={loading}
              emptyMessage="No claims registered yet."
            />
          </Card>
        </>
      ) : (
        <Card>
          <p>
            Your account does not have access to claims data. Use the navigation for the areas
            available to you.
          </p>
        </Card>
      )}
    </>
  );
}
