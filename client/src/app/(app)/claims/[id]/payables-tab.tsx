'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiMutate, apiRequest } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import type { Party, Payable } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, Input, SuffixInput } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { SearchSelect } from '@/components/ui/search-select';
import { Money } from '@/components/ui/stats';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';
import styles from './claim-tabs.module.css';

type PendingAction = { type: 'approve' | 'cancel'; payable: Payable } | null;

function loadParties(query: string) {
  return apiRequest<{ data: Party[] }>(`/parties?q=${encodeURIComponent(query)}&limit=20`).then(
    (response) => response.data,
  );
}

export function PayablesTab({
  claimId,
  currencyCode,
  onChanged,
}: {
  claimId: string;
  currencyCode: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canCreate = usePermission('payables.create');
  const canApprove = usePermission('payables.approve');
  const canCancel = usePermission('payables.cancel');
  const [payables, setPayables] = useState<Payable[]>();
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [payee, setPayee] = useState<Party | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const load = useCallback(
    () =>
      apiRequest<{ data: Payable[] }>(`/claims/${claimId}/payables`)
        .then((response) => {
          setPayables(response.data);
          setError('');
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Payables could not load.'),
        ),
    [claimId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payee) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await apiMutate(`/claims/${claimId}/payables`, {
        body: {
          payeePartyId: payee.id,
          amount: form.get('amount'),
          description: form.get('description') || null,
        },
      });
      setCreateOpen(false);
      setPayee(null);
      toast.success('Draft payable created.');
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to create payable.');
    } finally {
      setBusy(false);
    }
  }

  async function runPending(reason?: string) {
    if (!pending) return;
    setBusy(true);
    try {
      await apiMutate(`/payables/${pending.payable.id}/${pending.type}`, {
        body: pending.type === 'cancel' ? { reason } : undefined,
      });
      toast.success(pending.type === 'approve' ? 'Payable approved.' : 'Payable cancelled.');
      setPending(null);
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Payable>[] = [
    { key: 'payee', header: 'Payee', render: (payable) => payable.payee.displayName },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (payable) => <Money amount={payable.amount} currency={payable.currencyCode} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (payable) => <StatusBadge kind="payable" status={payable.status} />,
    },
    {
      key: 'description',
      header: 'Description',
      render: (payable) => payable.description || '—',
    },
    {
      key: 'journal',
      header: 'Journal',
      render: (payable) =>
        payable.journal ? (
          <div>
            <span>{payable.journal.journalNumber}</span>
            <div className={styles.journalLines}>
              {payable.journal.lines?.map((line) => (
                <span key={line.id}>
                  {line.glAccount.name}: Dr {line.debitAmount} / Cr {line.creditAmount}
                </span>
              ))}
            </div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (payable) =>
        payable.status === 'DRAFT' ? (
          <div className={styles.actionsCell}>
            {canApprove ? (
              <Button
                size="sm"
                icon="check"
                disabled={busy}
                onClick={() => setPending({ type: 'approve', payable })}
              >
                Approve
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setPending({ type: 'cancel', payable })}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <Card
        title="Indemnity payables"
        subtitle="Approving a payable posts a balanced journal against the claim."
        actions={
          canCreate ? (
            <Button icon="plus" size="sm" onClick={() => setCreateOpen(true)}>
              New Payable
            </Button>
          ) : undefined
        }
        flush
      >
        {error ? <p role="alert">{error}</p> : null}
        <DataTable
          columns={columns}
          rows={payables ?? []}
          rowKey={(payable) => payable.id}
          loading={payables === undefined && !error}
          emptyMessage="No payables have been recorded."
        />
      </Card>
      <Modal open={createOpen} title="New Payable" onClose={() => setCreateOpen(false)}>
        <form onSubmit={create} className={styles.formStack}>
          <Field label="Payee" required>
            <SearchSelect
              value={payee}
              onChange={setPayee}
              loadOptions={loadParties}
              getLabel={(party) => party.displayName}
              getKey={(party) => party.id}
              placeholder="Search parties…"
              required
            />
          </Field>
          <Field label="Amount" htmlFor="payable-amount" required>
            <SuffixInput
              id="payable-amount"
              name="amount"
              inputMode="decimal"
              pattern="\d+(\.\d{1,4})?"
              required
              suffix={currencyCode}
            />
          </Field>
          <Field label="Description" htmlFor="payable-description">
            <Input id="payable-description" name="description" maxLength={500} />
          </Field>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create Draft
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={pending?.type === 'approve'}
        title="Approve payable"
        message={
          pending
            ? `Approve the ${pending.payable.currencyCode} ${pending.payable.amount} payable to ${pending.payable.payee.displayName}? This posts the approval journal.`
            : ''
        }
        confirmLabel="Approve"
        busy={busy}
        onConfirm={() => void runPending()}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.type === 'cancel'}
        title="Cancel payable"
        message={
          pending
            ? `Cancel the draft payable to ${pending.payable.payee.displayName}? Provide a reason for the audit trail.`
            : ''
        }
        confirmLabel="Cancel payable"
        tone="danger"
        requireReason
        busy={busy}
        onConfirm={(reason) => void runPending(reason)}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
