'use client';

import { cx } from '@/lib/cx';
import { Icon } from './icon';
import styles from './pagination.module.css';

function pageNumbers(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  return [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const numbers = pageNumbers(page, totalPages);

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span className={styles.summary}>
        Showing {start} to {end} of {total}
      </span>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.pageButton}
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="chevron-left" size={14} />
        </button>
        {numbers.map((value, index) => (
          <span key={value} className={styles.numberWrap}>
            {index > 0 && numbers[index - 1] !== value - 1 ? (
              <span className={styles.ellipsis}>…</span>
            ) : null}
            <button
              type="button"
              className={cx(styles.pageButton, value === page && styles.active)}
              aria-current={value === page ? 'page' : undefined}
              onClick={() => onPageChange(value)}
            >
              {value}
            </button>
          </span>
        ))}
        <button
          type="button"
          className={styles.pageButton}
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    </nav>
  );
}
