import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icon';
import styles from './feedback.module.css';

export function EmptyState({
  icon = 'document',
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name={icon} size={22} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {message ? <p className={styles.emptyMessage}>{message}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = '0.85rem',
  className,
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return <span className={cx(styles.skeleton, className)} style={{ width, height }} aria-hidden />;
}

export type TimelineItem = {
  key: string;
  title: ReactNode;
  meta?: ReactNode;
  tone?: 'success' | 'neutral';
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className={styles.timeline}>
      {items.map((item) => (
        <li key={item.key} className={styles.timelineItem}>
          <span
            className={cx(
              styles.dot,
              item.tone === 'neutral' ? styles.dotNeutral : styles.dotSuccess,
            )}
            aria-hidden="true"
          />
          <div>
            <p className={styles.timelineTitle}>{item.title}</p>
            {item.meta ? <p className={styles.timelineMeta}>{item.meta}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
