import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './filter-bar.module.css';

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.bar, className)}>{children}</div>;
}

export function FilterItem({
  label,
  htmlFor,
  children,
  grow = false,
}: {
  label?: string;
  htmlFor?: string;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <div className={cx(styles.item, grow && styles.grow)}>
      {label ? (
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
        </label>
      ) : null}
      {children}
    </div>
  );
}

export function FilterSpacer() {
  return <span className={styles.spacer} aria-hidden="true" />;
}
