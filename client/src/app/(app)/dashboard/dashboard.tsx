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
import { Money } from '@/components/ui/stats';
import { Icon } from '@/components/ui/icon';
import styles from './dashboard.module.css';
import { StatusBadge } from '@/components/ui/status-badge';

const RECENT_COLUMNS: Column<Claim>[] = [
  {
    key: 'claimNumber',
    header: 'Claim / insured',
    render: (claim) => (
      <div className={styles.claimIdentity}>
        <Link href={`/claims/${claim.id}`} className="text-link">
          {claim.claimNumber}
        </Link>
        <span>{claim.insuredNameSnapshot ?? '—'}</span>
      </div>
    ),
    nowrap: true,
  },
  {
    key: 'loss',
    header: 'Loss details',
    render: (claim) => (
      <div className={styles.claimIdentity}>
        <span>{claim.lossNature}</span>
        <span>{formatDate(claim.lossDate)}</span>
      </div>
    ),
  },
  {
    key: 'estimatedLoss',
    header: 'Est. loss',
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
        subtitle={
          user ? `Welcome back, ${user.firstName}. Keep your claims moving forward.` : undefined
        }
        actions={
          canCreateClaims ? (
            <ButtonLink href="/claims/new" icon="plus">
              Create Claim
            </ButtonLink>
          ) : undefined
        }
      />
      {error ? <p role="alert">{error}</p> : null}
      {canViewClaims ? (
        <>
          <section className={styles.overview} aria-label="Portfolio overview">
            <div className={styles.total}>
              <span className={styles.totalIcon}>
                <Icon name="claims" size={24} />
              </span>
              <div>
                <span className={styles.eyebrow}>Registered claims</span>
                <strong>{loading ? '…' : error ? '—' : totalClaims}</strong>
              </div>
            </div>
            <div className={styles.distribution}>
              <span className={styles.eyebrow}>Portfolio by currency</span>
              <div className={styles.currencyCounts}>
                {loading ? (
                  <span>Loading portfolio…</span>
                ) : error ? (
                  <span>Unavailable</span>
                ) : summaries.length ? (
                  summaries.map((summary) => (
                    <Link
                      key={summary.currencyCode}
                      href={`/claims?currency=${summary.currencyCode}`}
                      className={styles.currencyCount}
                    >
                      <span>{summary.currencyCode}</span>
                      <strong>{summary.claimCount}</strong>
                      <Icon name="chevron-right" size={12} />
                    </Link>
                  ))
                ) : (
                  <span>No claims registered yet</span>
                )}
              </div>
            </div>
            <Link href="/claims" className={styles.portfolioLink}>
              Explore the register <Icon name="chevron-right" size={16} />
            </Link>
          </section>
          <div className={styles.workspace}>
            <div className={styles.claimsWorkspace}>
              <Card
                title="Recent claims"
                subtitle="Your five most recent losses"
                actions={
                  <ButtonLink href="/claims" variant="ghost" size="sm">
                    View all <Icon name="chevron-right" size={14} />
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
              <section className={styles.workQueues} aria-labelledby="work-queues-title">
                <div className={styles.sectionHeading}>
                  <span className={styles.eyebrow}>Continue your work</span>
                  <h2 id="work-queues-title">From reserve to settlement</h2>
                </div>
                <div className={styles.queueGrid}>
                  <Link href="/claims?status=RESERVED_NOT_SETTLED" className={styles.queue}>
                    <span className={styles.queueNumber}>01</span>
                    <strong>Reserved claims</strong>
                    <p>Review claims awaiting an approved indemnity.</p>
                    <span className={styles.queueAction}>
                      Review claims <Icon name="chevron-right" size={14} />
                    </span>
                  </Link>
                  <Link href="/claims?status=SETTLED_PAYMENT_OUTSTANDING" className={styles.queue}>
                    <span className={styles.queueNumber}>02</span>
                    <strong>Outstanding payments</strong>
                    <p>Follow up on approved indemnities with a balance.</p>
                    <span className={styles.queueAction}>
                      View outstanding <Icon name="chevron-right" size={14} />
                    </span>
                  </Link>
                  <Link href="/claims?status=SETTLED_AND_PAID" className={styles.queue}>
                    <span className={styles.queueNumber}>03</span>
                    <strong>Settled and paid</strong>
                    <p>Review claims whose indemnity has been paid.</p>
                    <span className={styles.queueAction}>
                      View paid claims <Icon name="chevron-right" size={14} />
                    </span>
                  </Link>
                </div>
              </section>
              {canReconcile ? (
                <Link href="/reconciliation" className={styles.reconcile}>
                  <span className={styles.reconcileIcon}>
                    <Icon name="reconciliation" size={22} />
                  </span>
                  <span>
                    <strong>Bring your payments into balance</strong>
                    <span>Match successful payments to bank and mobile-money transactions.</span>
                  </span>
                  <Icon name="chevron-right" size={20} />
                </Link>
              ) : null}
            </div>
            <section className={styles.financials} aria-labelledby="financial-title">
              <div className={styles.financialHeader}>
                <span className={styles.eyebrow}>Financial position</span>
                <h2 id="financial-title">Currency balances</h2>
                <p>Amounts in original currency</p>
              </div>
              {loading ? (
                <p className={styles.message} role="status">
                  Loading financial overview…
                </p>
              ) : error ? (
                <p className={styles.message}>Financial overview is unavailable.</p>
              ) : summaries.length === 0 ? (
                <p className={styles.message}>
                  No balances yet. Registered claims will appear here.
                </p>
              ) : (
                summaries.map((summary) => (
                  <article
                    key={summary.currencyCode}
                    className={styles.currencyCard}
                    aria-label={`${summary.currencyCode} financial summary`}
                  >
                    <div className={styles.currencyHeading}>
                      <span className={styles.currency}>{summary.currencyCode}</span>
                      <span>{summary.claimCount} claims</span>
                    </div>
                    <p className={styles.balanceLabel}>Outstanding indemnity</p>
                    <p className={styles.amount}>
                      <Money amount={summary.outstandingAmount} currency={summary.currencyCode} />
                    </p>
                    <dl className={styles.breakdown}>
                      <div>
                        <dt>Approved</dt>
                        <dd>
                          <Money amount={summary.approvedAmount} currency={summary.currencyCode} />
                        </dd>
                      </div>
                      <div>
                        <dt>Paid</dt>
                        <dd className={styles.paid}>
                          <Money amount={summary.paidAmount} currency={summary.currencyCode} />
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))
              )}
              <p className={styles.financialNote}>
                <Icon name="shield" size={14} />
                Balances reflect approved indemnity and successful payments.
              </p>
            </section>
          </div>
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
