'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Button } from './button';
import { Field, Textarea } from './form';
import { Icon } from './icon';
import styles from './overlay.module.css';

let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = '';
const overlayStack: HTMLElement[] = [];

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;

  return () => {
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount === 0) {
      document.body.style.overflow = bodyOverflowBeforeLock;
      bodyOverflowBeforeLock = '';
    }
  };
}

function useOverlayBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    overlayStack.push(panel);
    panel.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (overlayStack.at(-1) !== panel) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && panel) {
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            !element.matches(':disabled, [tabindex="-1"]') &&
            !element.closest('[hidden]') &&
            getComputedStyle(element).display !== 'none' &&
            getComputedStyle(element).visibility !== 'hidden',
        );
        if (focusable.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (document.activeElement === panel || !panel.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const unlockBodyScroll = lockBodyScroll();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const wasTop = overlayStack.at(-1) === panel;
      const index = overlayStack.indexOf(panel);
      if (index >= 0) overlayStack.splice(index, 1);
      unlockBodyScroll();
      if (wasTop && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return panelRef;
}

type OverlayProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

export function Modal({ open, title, onClose, children, footer, size = 'md' }: OverlayProps) {
  const panelRef = useOverlayBehavior(open, onClose);
  if (!open) return null;
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(styles.modal, styles[size])}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({ open, title, onClose, children, footer }: OverlayProps) {
  const panelRef = useOverlayBehavior(open, onClose);
  if (!open) return null;
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={styles.drawer}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'primary',
  requireReason = false,
  reasonLabel = 'Reason',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  requireReason?: boolean;
  reasonLabel?: string;
  busy?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');

  function cancel() {
    setReason('');
    onCancel();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    setReason('');
    onConfirm(requireReason ? trimmed : undefined);
  }

  return (
    <Modal open={open} title={title} onClose={cancel} size="sm">
      <form onSubmit={submit} className={styles.confirmForm}>
        <p className={styles.message}>{message}</p>
        {requireReason ? (
          <Field label={reasonLabel} htmlFor="confirm-reason" required>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={5}
              maxLength={500}
            />
          </Field>
        ) : null}
        <div className={styles.confirmActions}>
          <Button variant="secondary" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            disabled={requireReason && reason.trim().length < 5}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
