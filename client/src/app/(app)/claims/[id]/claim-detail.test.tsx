import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { ClaimDetail } from './claim-detail';
const state = vi.hoisted(() => ({ query: '', allowed: true }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock('@/lib/auth', () => ({ usePermission: () => state.allowed }));
const claim = {
  id: 'claim-1',
  claimNumber: 'CLM-2026-000001',
  policyNumberSnapshot: 'POL-001',
  policyNameSnapshot: 'Motor comprehensive',
  insuredNameSnapshot: 'Ama Mensah',
  lossNature: 'Collision',
  lossDate: '2026-09-01',
  notificationDate: '2026-09-02',
  description: 'Rear bumper damaged.',
  currencyCode: 'GHS',
  estimatedLossAmount: '12000',
  approvedAmount: '10000',
  paidAmount: '8000',
  outstandingAmount: '2000',
  overpaidAmount: '0',
  financialStatus: 'SETTLED_PAYMENT_OUTSTANDING',
  reserves: [],
  statusHistory: [],
};
beforeEach(() => {
  state.query = '';
  state.allowed = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({ data: url.endsWith('/claims/claim-1') ? claim : [] }),
    })),
  );
});
it('retains the complete overview and keeps financial context while navigating sections', async () => {
  render(
    <ToastProvider>
      <ClaimDetail id="claim-1" />
    </ToastProvider>,
  );
  await screen.findByRole('heading', { name: claim.claimNumber });
  for (const text of [
    'Motor comprehensive',
    'Ama Mensah',
    '01/09/2026',
    '02/09/2026',
    'Collision',
    'Rear bumper damaged.',
  ])
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  const nav = screen.getByRole('navigation', { name: 'Claim sections' });
  expect(within(nav).getAllByRole('button')).toHaveLength(7);
  for (const name of [
    'Reserves',
    'Payables',
    'Payments',
    'Reconciliation',
    'Documents',
    'Activity',
    'Overview',
  ]) {
    fireEvent.click(within(nav).getByRole('button', { name }));
    expect(screen.getByRole('region', { name })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('region', { name: 'Claim financial snapshot' })).toBeInTheDocument();
  }
});
it('honors existing section deep links and hides payment shortcuts without permission', async () => {
  state.query = 'tab=documents';
  state.allowed = false;
  render(
    <ToastProvider>
      <ClaimDetail id="claim-1" />
    </ToastProvider>,
  );
  await screen.findByRole('heading', { name: claim.claimNumber });
  expect(screen.getByRole('region', { name: 'Documents' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'View payment actions' })).not.toBeInTheDocument();
});
