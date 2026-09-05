'use client';

import { enumLabel, formatDate, formatDateTime } from '@/lib/format';
import type { Claim } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Timeline } from '@/components/ui/feedback';
import { Money } from '@/components/ui/stats';
import { StatusBadge } from '@/components/ui/status-badge';
import styles from './claim-tabs.module.css';

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.item}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function OverviewTab({ claim }: { claim: Claim }) {
  return (
    <div className={styles.overviewGrid}>
      <Card
        title="Claim Information"
        subtitle="Policy, insured and reported loss"
        className={styles.claimInformation}
      >
        <dl className={styles.infoList}>
          <Item label="Policy Number" value={claim.policyNumberSnapshot} />
          <Item label="Policy Name" value={claim.policyNameSnapshot || '—'} />
          <Item label="Insured" value={claim.insuredNameSnapshot} />
          <Item label="Loss Date" value={formatDate(claim.lossDate)} />
          <Item label="Date Notified" value={formatDate(claim.notificationDate)} />
          <Item label="Loss Nature" value={claim.lossNature} />
          <Item label="Description" value={claim.description || '—'} />
          <Item label="Currency" value={claim.currencyCode} />
        </dl>
      </Card>
      <Card
        title="Financial Summary (Indemnity)"
        subtitle="Amounts in the claim currency"
        className={styles.financialCard}
      >
        <dl className={`${styles.infoList} ${styles.financialList}`}>
          <Item
            label="Estimated Loss"
            value={<Money amount={claim.estimatedLossAmount} currency={claim.currencyCode} />}
          />
          <Item
            label="Approved Amount"
            value={<Money amount={claim.approvedAmount} currency={claim.currencyCode} />}
          />
          <Item
            label="Total Paid"
            value={<Money amount={claim.paidAmount} currency={claim.currencyCode} tone="success" />}
          />
          <Item
            label="Outstanding"
            value={
              <Money
                amount={claim.outstandingAmount}
                currency={claim.currencyCode}
                tone={Number(claim.outstandingAmount) > 0 ? 'danger' : 'success'}
              />
            }
          />
          {Number(claim.overpaidAmount || 0) > 0 ? (
            <Item
              label="Overpaid"
              value={
                <Money
                  amount={claim.overpaidAmount || '0'}
                  currency={claim.currencyCode}
                  tone="danger"
                />
              }
            />
          ) : null}
          <Item
            label="Status"
            value={<StatusBadge kind="claim" status={claim.financialStatus} />}
          />
        </dl>
      </Card>
      <Card title="Status History" className={styles.historyCard}>
        {claim.statusHistory?.length ? (
          <Timeline
            items={claim.statusHistory.map((event) => ({
              key: event.id,
              title: enumLabel(event.toStatus),
              meta: formatDateTime(event.changedAt),
            }))}
          />
        ) : (
          <p className={styles.muted}>No status changes recorded.</p>
        )}
      </Card>
    </div>
  );
}
