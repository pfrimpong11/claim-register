'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE_URL, apiMutate, apiRequest } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import type { Claim, ClaimListResponse, Currency } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterBar, FilterItem } from '@/components/ui/filter-bar';
import { DateInput, Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { Money } from '@/components/ui/stats';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';

import styles from './register.module.css';

const FALLBACK_CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP'];

const STATUS_OPTIONS = [
  { value: 'RESERVED_NOT_SETTLED', label: 'Reserved, not settled' },
  { value: 'SETTLED_PAYMENT_OUTSTANDING', label: 'Settled, payment outstanding' },
  { value: 'SETTLED_AND_PAID', label: 'Settled and paid' },
];

const COLUMNS: Column<Claim>[] = [
  {
    key: 'claimNumber',
    header: 'Claim / insured',
    nowrap: true,
    render: (claim) => (
      <div className={styles.identity}>
        <Link href={`/claims/${claim.id}`} className="text-link">
          {claim.claimNumber}
        </Link>
        <span>{claim.insuredNameSnapshot ?? '—'}</span>
      </div>
    ),
  },
  {
    key: 'policy',
    header: 'Policy',
    render: (claim) => (
      <div className={styles.identity}>
        <span>{claim.policyNumberSnapshot ?? '—'}</span>
        {claim.policyNameSnapshot ? <small>{claim.policyNameSnapshot}</small> : null}
      </div>
    ),
  },
  {
    key: 'loss',
    header: 'Loss details',
    render: (claim) => (
      <div className={styles.identity}>
        <span>{claim.lossNature}</span>
        <small>Loss: {formatDate(claim.lossDate)}</small>
        <small>Notified: {formatDate(claim.notificationDate)}</small>
      </div>
    ),
  },
  {
    key: 'indemnity',
    header: 'Indemnity',
    align: 'right',
    render: (claim) => (
      <dl className={styles.figures}>
        <div>
          <dt>Estimated</dt>
          <dd>
            <Money amount={claim.estimatedLossAmount} currency={claim.currencyCode} />
          </dd>
        </div>
        <div>
          <dt>Approved</dt>
          <dd>
            <Money amount={claim.approvedAmount} currency={claim.currencyCode} />
          </dd>
        </div>
      </dl>
    ),
  },
  {
    key: 'payments',
    header: 'Payments',
    align: 'right',
    render: (claim) => (
      <dl className={styles.figures}>
        <div>
          <dt>Paid</dt>
          <dd className={styles.paid}>
            <Money amount={claim.paidAmount} currency={claim.currencyCode} />
          </dd>
        </div>
        <div>
          <dt>Outstanding</dt>
          <dd>
            <Money amount={claim.outstandingAmount} currency={claim.currencyCode} />
          </dd>
        </div>
        <div>
          <dt>Overpaid</dt>
          <dd>
            <Money amount={claim.overpaidAmount || '0'} currency={claim.currencyCode} />
          </dd>
        </div>
      </dl>
    ),
  },
  {
    key: 'status',
    header: 'Financial status',
    render: (claim) => <StatusBadge kind="claim" status={claim.financialStatus} />,
  },
];

const ADVANCED_FILTER_KEYS = [
  'lossNature',
  'policy',
  'insured',
  'notificationFrom',
  'notificationTo',
];

const FILTER_KEYS = ['search', 'status', 'currency', 'lossFrom', 'lossTo', ...ADVANCED_FILTER_KEYS];

type ExportState = { status: string; errorMessage?: string };

export async function waitForReportCompletion(
  readStatus: () => Promise<ExportState>,
  wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 500)),
  maxAttempts = 120,
): Promise<ExportState> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait();
    const status = await readStatus();
    if (!['PENDING', 'PROCESSING'].includes(status.status)) return status;
  }
  throw new Error('The export is still being prepared. Please try again shortly.');
}

export function ClaimsRegister() {
  const router = useRouter();
  const toast = useToast();
  const canExport = usePermission('reports.export');
  const canCreate = usePermission('claims.create');
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [result, setResult] = useState<ClaimListResponse>();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [moreFilters, setMoreFilters] = useState(() =>
    ADVANCED_FILTER_KEYS.some((key) => searchParams.get(key)),
  );

  useEffect(() => {
    apiRequest<ClaimListResponse>(`/claims?${query}`)
      .then((response) => {
        setResult(response);
        setError('');
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'The register could not load.'),
      );
  }, [query]);

  useEffect(() => {
    apiRequest<{ data: Currency[] }>('/currencies')
      .then((response) => setCurrencies(response.data))
      .catch(() => setCurrencies([]));
  }, []);

  const currencyOptions = currencies.length
    ? currencies.map((currency) => ({ value: currency.code, label: currency.code }))
    : FALLBACK_CURRENCIES.map((code) => ({ value: code, label: code }));

  function pageHref(page: number) {
    const next = new URLSearchParams(query);
    next.set('page', String(page));
    return `/claims?${next}`;
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();

    for (const key of FILTER_KEYS) {
      const value = form.get(key);
      if (typeof value === 'string' && value.trim()) next.set(key, value.trim());
    }

    const destination = next.size ? `/claims?${next.toString()}` : '/claims';
    router.push(destination);
  }

  async function exportClaims() {
    setExporting(true);
    try {
      const created = await apiMutate<{ data: { id: string } }>(`/reports/claims-exports?${query}`);
      const status = await waitForReportCompletion(
        async () =>
          (await apiRequest<{ data: ExportState }>(`/reports/claims-exports/${created.data.id}`))
            .data,
      );
      if (status.status !== 'COMPLETED') throw new Error(status.errorMessage ?? 'Export failed.');
      const response = await fetch(
        `${API_BASE_URL}/reports/claims-exports/${created.data.id}/download`,
        { credentials: 'include' },
      );
      if (!response.ok) throw new Error('The completed export could not be downloaded.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `claims-register-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Claims"
        subtitle="Search, filter, and export registered claims."
        actions={
          <>
            {canExport ? (
              <Button
                variant="secondary"
                icon="download"
                loading={exporting}
                onClick={() => void exportClaims()}
              >
                {exporting ? 'Preparing export…' : 'Export'}
              </Button>
            ) : null}
            {canCreate ? (
              <ButtonLink href="/claims/new" icon="plus">
                Create Claim
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <Card
        className={styles.registerCard}
        title="Claims register"
        subtitle={
          result
            ? `${result.meta.total} claims match your filters`
            : 'Find and review your registered claims'
        }
      >
        <form key={query} onSubmit={applyFilters} className={styles.filterForm}>
          <FilterBar className={styles.filterGrid}>
            <FilterItem label="Search register" htmlFor="filter-search" grow>
              <Input
                id="filter-search"
                name="search"
                type="search"
                defaultValue={searchParams.get('search') ?? ''}
                placeholder="Search claim, policy, insured…"
                aria-label="Search claims"
              />
            </FilterItem>
            <FilterItem label="Status" htmlFor="filter-status">
              <Select
                id="filter-status"
                name="status"
                defaultValue={searchParams.get('status') ?? ''}
                placeholder="All"
                options={STATUS_OPTIONS}
              />
            </FilterItem>
            <FilterItem label="Currency" htmlFor="filter-currency">
              <Select
                id="filter-currency"
                name="currency"
                defaultValue={searchParams.get('currency') ?? ''}
                placeholder="All"
                options={currencyOptions}
              />
            </FilterItem>
            <FilterItem label="From Date" htmlFor="filter-loss-from">
              <DateInput
                id="filter-loss-from"
                name="lossFrom"
                defaultValue={searchParams.get('lossFrom') ?? ''}
              />
            </FilterItem>
            <FilterItem label="To Date" htmlFor="filter-loss-to">
              <DateInput
                id="filter-loss-to"
                name="lossTo"
                defaultValue={searchParams.get('lossTo') ?? ''}
              />
            </FilterItem>
            <div className={styles.filterActions}>
              <Button
                variant="ghost"
                icon="filter"
                onClick={() => setMoreFilters((current) => !current)}
                aria-expanded={moreFilters}
              >
                Filters
              </Button>
              <ButtonLink href="/claims" variant="ghost">
                Clear all
              </ButtonLink>
              <Button type="submit" variant="secondary">
                Apply
              </Button>
            </div>
          </FilterBar>
          <div hidden={!moreFilters}>
            <FilterBar className={styles.filterGrid}>
              <FilterItem label="Loss nature" htmlFor="filter-loss-nature" grow>
                <Input
                  id="filter-loss-nature"
                  name="lossNature"
                  defaultValue={searchParams.get('lossNature') ?? ''}
                />
              </FilterItem>
              <FilterItem label="Policy" htmlFor="filter-policy" grow>
                <Input
                  id="filter-policy"
                  name="policy"
                  defaultValue={searchParams.get('policy') ?? ''}
                />
              </FilterItem>
              <FilterItem label="Insured" htmlFor="filter-insured" grow>
                <Input
                  id="filter-insured"
                  name="insured"
                  defaultValue={searchParams.get('insured') ?? ''}
                />
              </FilterItem>
              <FilterItem label="Notified from" htmlFor="filter-notified-from">
                <DateInput
                  id="filter-notified-from"
                  name="notificationFrom"
                  defaultValue={searchParams.get('notificationFrom') ?? ''}
                />
              </FilterItem>
              <FilterItem label="Notified to" htmlFor="filter-notified-to">
                <DateInput
                  id="filter-notified-to"
                  name="notificationTo"
                  defaultValue={searchParams.get('notificationTo') ?? ''}
                />
              </FilterItem>
            </FilterBar>
          </div>
        </form>
        {error ? <p role="alert">{error}</p> : null}
        <div className={styles.tableArea}>
          <DataTable
            columns={COLUMNS}
            rows={result?.data ?? []}
            rowKey={(claim) => claim.id}
            loading={!result && !error}
            emptyMessage="No claims match the current search."
            footer={
              result && result.meta.total > 0 ? (
                <Pagination
                  page={result.meta.page}
                  totalPages={result.meta.totalPages ?? 1}
                  total={result.meta.total}
                  pageSize={result.meta.pageSize}
                  onPageChange={(page) => router.push(pageHref(page))}
                />
              ) : undefined
            }
          />
        </div>
      </Card>

      <Card
        title="Totals by currency"
        subtitle="All claims matching the current filters · indemnity only"
        flush
      >
        <DataTable
          caption="Claims totals by currency"
          columns={[
            { key: 'currencyCode', header: 'Currency' },
            {
              key: 'estimatedLoss',
              header: 'Estimated Loss',
              align: 'right',
              render: (summary) => (
                <Money amount={summary.estimatedLoss} currency={summary.currencyCode} />
              ),
            },
            {
              key: 'approvedAmount',
              header: 'Approved (Indemnity)',
              align: 'right',
              render: (summary) => (
                <Money amount={summary.approvedAmount} currency={summary.currencyCode} />
              ),
            },
            {
              key: 'paidAmount',
              header: 'Total Paid',
              align: 'right',
              render: (summary) => (
                <Money amount={summary.paidAmount} currency={summary.currencyCode} />
              ),
            },
            {
              key: 'outstandingAmount',
              header: 'Outstanding',
              align: 'right',
              render: (summary) => (
                <Money amount={summary.outstandingAmount} currency={summary.currencyCode} />
              ),
            },
            {
              key: 'overpaidAmount',
              header: 'Overpaid',
              align: 'right',
              render: (summary) => (
                <Money amount={summary.overpaidAmount || '0'} currency={summary.currencyCode} />
              ),
            },
          ]}
          rows={error ? [] : (result?.summaries ?? [])}
          rowKey={(summary) => summary.currencyCode}
          loading={!result && !error}
          emptyMessage={error ? 'Totals are unavailable.' : 'No totals for the current filters.'}
        />
      </Card>
    </>
  );
}
