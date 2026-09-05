'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './icon';
import styles from './search-select.module.css';

const DEBOUNCE_MS = 300;

export function SearchSelect<T>({
  value,
  onChange,
  loadOptions,
  getLabel,
  getKey,
  renderOption,
  placeholder = 'Search…',
  actionSlot,
  inputId,
  disabled = false,
  required = false,
}: {
  value: T | null;
  onChange: (value: T | null) => void;
  loadOptions: (query: string) => Promise<T[]>;
  getLabel: (item: T) => string;
  getKey: (item: T) => string;
  renderOption?: (item: T) => ReactNode;
  placeholder?: string;
  /** Rendered at the bottom of the dropdown (e.g. an "+ Add" button). */
  actionSlot?: ReactNode;
  inputId?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      loadOptions(editing ? query : '')
        .then((results) => {
          if (cancelled) return;
          setOptions(results);
          setHighlight(0);
        })
        .catch((loadError: unknown) => {
          if (cancelled) return;
          setOptions([]);
          setError(loadError instanceof Error ? loadError.message : 'Search failed.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, editing, loadOptions]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function select(item: T) {
    onChange(item);
    setOpen(false);
    setEditing(false);
    setQuery('');
  }

  const displayValue = editing ? query : value ? getLabel(value) : '';

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.inputWrap}>
        <span className={styles.searchIcon}>
          <Icon name="search" size={14} />
        </span>
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className={styles.input}
          placeholder={placeholder}
          value={displayValue}
          disabled={disabled}
          required={required && !value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setEditing(true);
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setHighlight((current) => Math.min(current + 1, options.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlight((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              if (open && options[highlight]) {
                event.preventDefault();
                select(options[highlight]);
              }
            } else if (event.key === 'Escape') {
              setOpen(false);
              setEditing(false);
            }
          }}
        />
        {value && !disabled ? (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear selection"
            onClick={() => {
              onChange(null);
              setQuery('');
              setEditing(false);
            }}
          >
            <Icon name="close" size={12} />
          </button>
        ) : (
          <span className={styles.chevron}>
            <Icon name="chevron-down" size={14} />
          </span>
        )}
      </div>
      {open ? (
        <div className={styles.dropdown}>
          <ul id={listboxId} role="listbox" className={styles.list}>
            {loading ? <li className={styles.notice}>Searching…</li> : null}
            {!loading && error ? <li className={styles.notice}>{error}</li> : null}
            {!loading && !error && options.length === 0 ? (
              <li className={styles.notice}>No results found.</li>
            ) : null}
            {!loading &&
              options.map((item, index) => (
                <li
                  key={getKey(item)}
                  role="option"
                  aria-selected={value ? getKey(value) === getKey(item) : false}
                  className={cx(styles.option, index === highlight && styles.highlighted)}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    select(item);
                  }}
                >
                  {renderOption ? renderOption(item) : getLabel(item)}
                </li>
              ))}
          </ul>
          {actionSlot ? <div className={styles.actionSlot}>{actionSlot}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
