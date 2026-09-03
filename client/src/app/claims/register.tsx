'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL, apiRequest, readCookie } from '@/lib/api';
type Claim = {
  id: string;
  claimNumber: string;
  policyNumberSnapshot: string;
  insuredNameSnapshot: string;
  lossDate: string;
  notificationDate: string;
  lossNature: string;
  currencyCode: string;
  estimatedLossAmount: string;
  financialStatus: string;
};
type Result = {
  data: Claim[];
  meta: { total: number; page: number; totalPages: number };
  summaries: { currencyCode: string; claimCount: number; estimatedLoss: string }[];
};
export function ClaimsRegister() {
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  useEffect(() => {
    apiRequest<Result>(`/claims?${query}`)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, [query]);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(query);
    next.set('page', String(page));
    return `/claims?${next}`;
  };
  async function exportClaims() {
    setExporting(true);
    setError('');
    try {
      const created = await apiRequest<{ data: { id: string } }>(
        `/reports/claims-exports?${query}`,
        { method: 'POST', headers: { 'X-CSRF-Token': readCookie('claims_csrf') ?? '' } },
      );
      let status: { status: string; errorMessage?: string };
      do {
        await new Promise((resolve) => setTimeout(resolve, 500));
        status = (
          await apiRequest<{ data: { status: string; errorMessage?: string } }>(
            `/reports/claims-exports/${created.data.id}`,
          )
        ).data;
      } while (['PENDING', 'PROCESSING'].includes(status.status));
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }
  return (
    <section className="wide">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Claims register</p>
          <h1>Claims</h1>
        </div>
        <div>
          <button type="button" disabled={exporting} onClick={() => void exportClaims()}>
            {exporting ? 'Preparing export…' : 'Export CSV'}
          </button>{' '}
          <Link href="/claims/new">Register claim</Link>
        </div>
      </div>
      <form action="/claims" className="filter-grid">
        <label>
          Search
          <input
            name="search"
            defaultValue={searchParams.get('search') ?? ''}
            placeholder="Claim, policy, or insured"
          />
        </label>
        <label>
          Currency
          <select name="currency" defaultValue={searchParams.get('currency') ?? ''}>
            <option value="">All</option>
            {['GHS', 'USD', 'EUR', 'GBP'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Loss nature
          <input name="lossNature" defaultValue={searchParams.get('lossNature') ?? ''} />
        </label>
        <label>
          Policy
          <input name="policy" defaultValue={searchParams.get('policy') ?? ''} />
        </label>
        <label>
          Insured
          <input name="insured" defaultValue={searchParams.get('insured') ?? ''} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={searchParams.get('status') ?? ''}>
            <option value="">All</option>
            <option value="RESERVED_NOT_SETTLED">Reserved, not settled</option>
            <option value="SETTLED_PAYMENT_OUTSTANDING">Settled, payment outstanding</option>
            <option value="SETTLED_AND_PAID">Settled and paid</option>
          </select>
        </label>
        <label>
          Loss from
          <input type="date" name="lossFrom" defaultValue={searchParams.get('lossFrom') ?? ''} />
        </label>
        <label>
          Loss to
          <input type="date" name="lossTo" defaultValue={searchParams.get('lossTo') ?? ''} />
        </label>
        <label>
          Notified from
          <input
            type="date"
            name="notificationFrom"
            defaultValue={searchParams.get('notificationFrom') ?? ''}
          />
        </label>
        <label>
          Notified to
          <input
            type="date"
            name="notificationTo"
            defaultValue={searchParams.get('notificationTo') ?? ''}
          />
        </label>
        <button type="submit">Apply filters</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="summary-grid">
        {result?.summaries.map((s) => (
          <article key={s.currencyCode}>
            <strong>
              {s.currencyCode} {s.estimatedLoss}
            </strong>
            <span>{s.claimCount} claims</span>
          </article>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Claim</th>
              <th>Policy / insured</th>
              <th>Loss</th>
              <th>Estimated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {result?.data.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/claims/${c.id}`}>{c.claimNumber}</Link>
                </td>
                <td>
                  {c.policyNumberSnapshot}
                  <br />
                  {c.insuredNameSnapshot}
                </td>
                <td>
                  {new Date(c.lossDate).toLocaleDateString()}
                  <br />
                  {c.lossNature}
                </td>
                <td>
                  {c.currencyCode} {c.estimatedLossAmount}
                </td>
                <td>{c.financialStatus.replaceAll('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result && !result.data.length && <p>No claims match the current search.</p>}
      {result && (
        <nav aria-label="Claims pages">
          <span>{result.meta.total} claims</span>
          {result.meta.page > 1 && <Link href={pageHref(result.meta.page - 1)}>Previous</Link>}
          {result.meta.page < result.meta.totalPages && (
            <Link href={pageHref(result.meta.page + 1)}>Next</Link>
          )}
        </nav>
      )}
    </section>
  );
}
