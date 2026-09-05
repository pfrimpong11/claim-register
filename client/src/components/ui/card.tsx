import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './card.module.css';

export function Card({
  title,
  subtitle,
  actions,
  children,
  flush = false,
  allowOverflow = false,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Removes body padding — for cards whose body is a full-bleed table. */
  flush?: boolean;
  /** Allows popovers and combobox lists to extend beyond the card boundary. */
  allowOverflow?: boolean;
  className?: string;
}) {
  return (
    <div className={cx(styles.card, allowOverflow && styles.allowOverflow, className)}>
      {title || actions ? (
        <div className={styles.header}>
          <div>
            {title ? <h2 className={styles.title}>{title}</h2> : null}
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
      <div className={cx(styles.body, flush && styles.flush)}>{children}</div>
    </div>
  );
}
