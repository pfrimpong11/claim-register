'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import type { Claim } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/ui/status-badge';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { ActivityTab } from './activity-tab';
import { DocumentsTab } from './documents-tab';
import { OverviewTab } from './overview-tab';
import { PayablesTab } from './payables-tab';
import { PaymentsTab } from './payments-tab';
import { ReconciliationTab } from './reconciliation-tab';
import { ReservesTab } from './reserves-tab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'reserves', label: 'Reserves' },
  { id: 'payables', label: 'Payables' },
  { id: 'payments', label: 'Payments' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
];

export function ClaimDetail({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get('tab') ?? 'overview';
    return TABS.some((tab) => tab.id === requested) ? requested : 'overview';
  });
  const [claim, setClaim] = useState<Claim>();
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      apiRequest<{ data: Claim }>(`/claims/${id}`)
        .then((response) => setClaim(response.data))
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'The claim could not load.'),
        ),
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectTab = useCallback((tab: string) => {
    setActiveTab(tab);
    // Shallow URL sync keeps the tab deep-linkable without a server round-trip.
    const next = new URLSearchParams(window.location.search);
    next.set('tab', tab);
    window.history.replaceState(null, '', `${window.location.pathname}?${next}`);
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!claim) {
    return (
      <div role="status" aria-label="Loading claim" style={{ display: 'grid', gap: '0.75rem' }}>
        <Skeleton width="16rem" height="1.5rem" />
        <Skeleton width="100%" height="8rem" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={claim.claimNumber}
        badge={<StatusBadge kind="claim" status={claim.financialStatus} />}
        subtitle={`${claim.policyNumberSnapshot} · ${claim.insuredNameSnapshot}`}
        actions={
          activeTab !== 'payments' ? (
            <Button icon="plus" onClick={() => selectTab('payments')}>
              New Payment
            </Button>
          ) : undefined
        }
      />
      <Tabs tabs={TABS} activeId={activeTab} onChange={selectTab} />
      {activeTab === 'overview' ? (
        <TabPanel tabId="overview">
          <OverviewTab claim={claim} />
        </TabPanel>
      ) : null}
      {activeTab === 'reserves' ? (
        <TabPanel tabId="reserves">
          <ReservesTab claim={claim} />
        </TabPanel>
      ) : null}
      {activeTab === 'payables' ? (
        <TabPanel tabId="payables">
          <PayablesTab claimId={id} currencyCode={claim.currencyCode} onChanged={load} />
        </TabPanel>
      ) : null}
      {activeTab === 'payments' ? (
        <TabPanel tabId="payments">
          <PaymentsTab claim={claim} onChanged={load} />
        </TabPanel>
      ) : null}
      {activeTab === 'reconciliation' ? (
        <TabPanel tabId="reconciliation">
          <ReconciliationTab claimId={id} />
        </TabPanel>
      ) : null}
      {activeTab === 'documents' ? (
        <TabPanel tabId="documents">
          <DocumentsTab claimId={id} />
        </TabPanel>
      ) : null}
      {activeTab === 'activity' ? (
        <TabPanel tabId="activity">
          <ActivityTab claim={claim} />
        </TabPanel>
      ) : null}
    </>
  );
}
