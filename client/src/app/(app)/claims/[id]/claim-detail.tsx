'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import type { Claim } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';
import { Money } from '@/components/ui/stats';
import { Icon } from '@/components/ui/icon';
import { usePermission } from '@/lib/auth';
import styles from './claim-detail.module.css';
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
  const canCreatePayment = usePermission('payments.create');
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get('tab') ?? 'overview';
    return TABS.some((tab) => tab.id === requested) ? requested : 'overview';
  });
  const [claim, setClaim] = useState<Claim>();
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      apiRequest<{ data: Claim }>(`/claims/${id}`)
        .then((response) => {
          setClaim(response.data);
          setError('');
        })
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
      <Link href="/claims" className={styles.backLink}>
        <Icon name="chevron-left" size={14} />
        Back to claims
      </Link>
      <div className={styles.claimHeader}>
        <div className={styles.claimMark}>
          <Icon name="claims" size={26} />
        </div>
        <PageHeader
          title={claim.claimNumber}
          badge={<StatusBadge kind="claim" status={claim.financialStatus} />}
          subtitle={`${claim.policyNumberSnapshot} · ${claim.insuredNameSnapshot}`}
          actions={
            canCreatePayment && activeTab !== 'payments' ? (
              <Button icon="plus" onClick={() => selectTab('payments')}>
                View payment actions
              </Button>
            ) : undefined
          }
        />
      </div>
      <section className={styles.financialStrip} aria-label="Claim financial snapshot">
        {[
          { label: 'Estimated loss', amount: claim.estimatedLossAmount },
          { label: 'Approved indemnity', amount: claim.approvedAmount },
          { label: 'Total paid', amount: claim.paidAmount },
          { label: 'Outstanding', amount: claim.outstandingAmount },
          { label: 'Overpaid', amount: claim.overpaidAmount || '0' },
        ].map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>
              <Money amount={item.amount} currency={claim.currencyCode} />
            </strong>
          </div>
        ))}
      </section>
      <div className={styles.workspace}>
        <nav className={styles.sectionNav} aria-label="Claim sections">
          <p>Claim workspace</p>
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? styles.selected : undefined}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              aria-controls="claim-section-content"
              aria-label={tab.label}
              onClick={() => selectTab(tab.id)}
            >
              <span className={styles.sectionNumber}>{String(index + 1).padStart(2, '0')}</span>
              {tab.label}
              <Icon name="chevron-right" size={12} />
            </button>
          ))}
          <div className={styles.sectionNote}>
            <Icon name="shield" size={18} />
            <span>
              Claim currency<strong>{claim.currencyCode}</strong>
            </span>
          </div>
        </nav>
        <div id="claim-section-content" className={styles.sectionContent}>
          {activeTab === 'overview' ? (
            <section aria-label="Overview">
              <OverviewTab claim={claim} />
            </section>
          ) : null}
          {activeTab === 'reserves' ? (
            <section aria-label="Reserves">
              <ReservesTab claim={claim} />
            </section>
          ) : null}
          {activeTab === 'payables' ? (
            <section aria-label="Payables">
              <PayablesTab claimId={id} currencyCode={claim.currencyCode} onChanged={load} />
            </section>
          ) : null}
          {activeTab === 'payments' ? (
            <section aria-label="Payments">
              <PaymentsTab claim={claim} onChanged={load} />
            </section>
          ) : null}
          {activeTab === 'reconciliation' ? (
            <section aria-label="Reconciliation">
              <ReconciliationTab claimId={id} />
            </section>
          ) : null}
          {activeTab === 'documents' ? (
            <section aria-label="Documents">
              <DocumentsTab claimId={id} />
            </section>
          ) : null}
          {activeTab === 'activity' ? (
            <section aria-label="Activity">
              <ActivityTab claim={claim} />
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
