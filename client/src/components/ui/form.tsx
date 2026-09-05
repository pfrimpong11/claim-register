import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './form.module.css';

export function Field({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cx(styles.control, className)} {...rest} />;
}

export function DateInput({ className, ...rest }: ComponentProps<'input'>) {
  return <input type="date" className={cx(styles.control, className)} {...rest} />;
}

export function Textarea({ className, rows = 3, ...rest }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cx(styles.control, className)} {...rest} />;
}

export type SelectOption = { value: string; label: string };

export function Select({
  options,
  placeholder,
  className,
  children,
  ...rest
}: ComponentProps<'select'> & { options?: SelectOption[]; placeholder?: string }) {
  return (
    <select className={cx(styles.control, className)} {...rest}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
}

/** Input with a fixed suffix (e.g. a currency code) rendered inside the control. */
export function SuffixInput({
  suffix,
  className,
  ...rest
}: ComponentProps<'input'> & { suffix: string }) {
  return (
    <div className={cx(styles.suffixWrap, className)}>
      <input className={cx(styles.control, styles.suffixInput)} {...rest} />
      <span className={styles.suffix}>{suffix}</span>
    </div>
  );
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.grid, className)}>{children}</div>;
}
