'use client';

import { cx } from '@/lib/cx';
import styles from './tabs.module.css';

export type TabItem = {
  id: string;
  label: string;
  count?: number;
};

export function Tabs({
  tabs,
  activeId,
  onChange,
  className,
}: {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx(styles.tablist, className)}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const index = tabs.findIndex((item) => item.id === activeId);
              const delta = event.key === 'ArrowRight' ? 1 : -1;
              const next = tabs[(index + delta + tabs.length) % tabs.length];
              onChange(next.id);
              document.getElementById(`tab-${next.id}`)?.focus();
            }}
          >
            {tab.label}
            {tab.count !== undefined ? <span className={styles.count}>({tab.count})</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  tabId,
  children,
  className,
}: {
  tabId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      className={className}
    >
      {children}
    </div>
  );
}
