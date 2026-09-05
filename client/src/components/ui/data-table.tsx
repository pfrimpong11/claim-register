import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { EmptyState } from './feedback';
import { Skeleton } from './feedback';
import styles from './data-table.module.css';

export type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  nowrap?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = 'No records found.',
  footer,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  footer?: ReactNode;
  caption?: string;
}) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        {caption ? <caption className={styles.caption}>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={cx(column.align === 'right' && styles.right)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 4 }, (_, index) => (
                <tr key={`skeleton-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      <Skeleton />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={rowKey(row)} className={styles.row}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cx(
                        column.align === 'right' && styles.right,
                        column.nowrap && styles.nowrap,
                      )}
                    >
                      {column.render
                        ? column.render(row)
                        : ((row as Record<string, unknown>)[column.key] as ReactNode)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 ? <EmptyState title={emptyMessage} /> : null}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
