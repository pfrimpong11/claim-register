import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import styles from './stats.module.css';

export function Money({
  amount,
  currency,
  tone,
  className,
}: {
  amount: string | number;
  currency?: string;
  tone?: 'success' | 'danger' | 'muted';
  className?: string;
}) {
  return (
    <span className={cx(styles.money, tone && styles[tone], className)}>
      {formatMoney(amount, currency)}
    </span>
  );
}

export function SummaryStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: 'success' | 'danger' | 'muted';
  hint?: string;
}) {
  return (
    <div className={styles.stat}>
      <p className={styles.statLabel}>{label}</p>
      <p className={cx(styles.statValue, tone && styles[tone])}>{value}</p>
      {hint ? <p className={styles.statHint}>{hint}</p> : null}
    </div>
  );
}

export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.row, className)}>{children}</div>;
}
