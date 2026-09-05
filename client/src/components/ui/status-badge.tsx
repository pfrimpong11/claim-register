import { enumLabel } from '@/lib/format';
import { cx } from '@/lib/cx';
import styles from './status-badge.module.css';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type BadgeKind = 'claim' | 'payment' | 'payable' | 'reconciliation' | 'import' | 'boolean';

const STATUS_MAP: Record<BadgeKind, Record<string, { label: string; tone: Tone }>> = {
  claim: {
    RESERVED_NOT_SETTLED: { label: 'Reserved, not settled', tone: 'info' },
    SETTLED_PAYMENT_OUTSTANDING: { label: 'Settled, payment outstanding', tone: 'warning' },
    SETTLED_AND_PAID: { label: 'Settled and paid', tone: 'success' },
  },
  payment: {
    DRAFT: { label: 'Draft', tone: 'neutral' },
    APPROVED: { label: 'Approved', tone: 'info' },
    PROCESSING: { label: 'Processing', tone: 'warning' },
    SUCCESSFUL: { label: 'Successful', tone: 'success' },
    FAILED: { label: 'Failed', tone: 'danger' },
    REVERSED: { label: 'Reversed', tone: 'danger' },
  },
  payable: {
    DRAFT: { label: 'Draft', tone: 'neutral' },
    APPROVED: { label: 'Approved', tone: 'success' },
    CANCELLED: { label: 'Cancelled', tone: 'danger' },
  },
  reconciliation: {
    UNMATCHED: { label: 'Unmatched', tone: 'danger' },
    PARTIALLY_MATCHED: { label: 'Partially matched', tone: 'warning' },
    MATCHED: { label: 'Matched', tone: 'success' },
  },
  import: {
    PENDING: { label: 'Pending', tone: 'neutral' },
    PROCESSING: { label: 'Processing', tone: 'warning' },
    COMPLETED: { label: 'Completed', tone: 'success' },
    COMPLETED_WITH_ERRORS: { label: 'Completed with errors', tone: 'warning' },
    FAILED: { label: 'Failed', tone: 'danger' },
  },
  boolean: {
    YES: { label: 'Yes', tone: 'success' },
    NO: { label: 'No', tone: 'danger' },
  },
};

export function StatusBadge({
  kind,
  status,
  className,
}: {
  kind: BadgeKind;
  status: string;
  className?: string;
}) {
  const entry = STATUS_MAP[kind][status] ?? { label: enumLabel(status), tone: 'neutral' as Tone };
  return <span className={cx(styles.badge, styles[entry.tone], className)}>{entry.label}</span>;
}

/** Generic pill for arbitrary enum values (e.g. source types, roles). */
export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cx(styles.badge, styles[tone], className)}>{children}</span>;
}
