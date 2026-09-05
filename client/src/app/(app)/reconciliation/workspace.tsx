'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiMutate, apiRequest } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import type {
  ExternalTransaction,
  ReconciliationPayment,
  SettlementAccount,
  TransactionImport,
} from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Drawer } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { ImportsPanel } from './imports-panel';
import { PaymentsPanel } from './payments-panel';
import { TransactionsPanel } from './transactions-panel';
import styles from './reconciliation.module.css';

const SOURCE_OPTIONS = [
  { value: 'BANK_STATEMENT', label: 'Bank statement' },
  { value: 'MOMO_STATEMENT', label: 'Mobile-money statement' },
  { value: 'GATEWAY_WEBHOOK', label: 'Gateway export' },
  { value: 'MANUAL_IMPORT', label: 'Manual import' },
];

export function ReconciliationWorkspace() {
  const toast = useToast();
  const canImport = usePermission('reconciliation.import');
  const [accounts, setAccounts] = useState<SettlementAccount[]>([]);
  const [transactions, setTransactions] = useState<ExternalTransaction[]>([]);
  const [payments, setPayments] = useState<ReconciliationPayment[]>([]);
  const [imports, setImports] = useState<TransactionImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const reload = useCallback(
    () =>
      Promise.all([
        apiRequest<{ data: SettlementAccount[] }>('/settlement-accounts'),
        // The server ignores query defaults on this route — always send page and pageSize.
        apiRequest<{ data: ExternalTransaction[] }>('/external-transactions?page=1&pageSize=50'),
        apiRequest<{ data: ReconciliationPayment[] }>('/reconciliation-payments'),
        apiRequest<{ data: TransactionImport[] }>('/transaction-imports'),
      ])
        .then(([accountsResult, transactionsResult, paymentsResult, importsResult]) => {
          setAccounts(accountsResult.data);
          setTransactions(transactionsResult.data);
          setPayments(paymentsResult.data);
          setImports(importsResult.data);
          setError('');
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Reconciliation could not load.'),
        )
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportBusy(true);
    try {
      await apiMutate('/transaction-imports', { body: new FormData(event.currentTarget) });
      setImportOpen(false);
      toast.success('Import queued. Refresh to follow its progress.');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reconciliation"
        subtitle="Match successful payments against imported bank and mobile-money evidence. Partial matches are supported."
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={() => void reload()}>
              Refresh
            </Button>
            {canImport ? (
              <Button icon="upload" onClick={() => setImportOpen(true)}>
                Import Transactions
              </Button>
            ) : null}
          </>
        }
      />
      {error ? <p role="alert">{error}</p> : null}
      <TransactionsPanel
        transactions={transactions}
        payments={payments}
        loading={loading}
        onChanged={reload}
      />
      <PaymentsPanel payments={payments} loading={loading} />
      <ImportsPanel imports={imports} loading={loading} />
      <Drawer open={importOpen} title="Import Transactions" onClose={() => setImportOpen(false)}>
        <form onSubmit={upload} className={styles.formStack}>
          <Field label="Settlement Account" htmlFor="import-account" required>
            <Select
              id="import-account"
              name="settlementAccountId"
              required
              placeholder="Select account"
              options={accounts.map((account) => ({
                value: account.id,
                label: `${account.name} (${account.currencyCode})`,
              }))}
            />
          </Field>
          <Field label="Source" htmlFor="import-source" required>
            <Select id="import-source" name="sourceType" required options={SOURCE_OPTIONS} />
          </Field>
          <Field
            label="CSV File"
            htmlFor="import-file"
            required
            hint="Columns: externalReference, transactionDate, valueDate, transactionType, amount, currencyCode, description"
          >
            <Input id="import-file" name="file" type="file" accept=".csv,text/csv" required />
          </Field>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setImportOpen(false)} disabled={importBusy}>
              Cancel
            </Button>
            <Button type="submit" loading={importBusy}>
              Queue Import
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
