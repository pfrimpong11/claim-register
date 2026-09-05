import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Dashboard } from './dashboard';

const mocks = vi.hoisted(() => ({ request: vi.fn(), allowed: true }));
vi.mock('@/lib/api', () => ({ apiRequest: mocks.request }));
vi.mock('@/lib/auth', () => ({
  useCurrentUser: () => ({ user: { firstName: 'Ama' } }),
  usePermission: () => mocks.allowed,
}));
beforeEach(() => {
  mocks.allowed = true;
  mocks.request.mockReset();
});
it('keeps currency totals separate and links to the register', async () => {
  mocks.request.mockResolvedValue({
    data: [],
    meta: { total: 7 },
    summaries: [
      {
        currencyCode: 'GHS',
        claimCount: 4,
        outstandingAmount: '1200',
        approvedAmount: '2000',
        paidAmount: '800',
      },
      {
        currencyCode: 'USD',
        claimCount: 3,
        outstandingAmount: '300',
        approvedAmount: '500',
        paidAmount: '200',
      },
    ],
  });
  render(<Dashboard />);
  const ghs = await screen.findByRole('article', { name: 'GHS financial summary' });
  expect(within(ghs).getByText('GHS 1,200.00')).toBeInTheDocument();
  expect(within(ghs).queryByText(/USD/)).not.toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'USD financial summary' })).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Outstanding payments/ })).toHaveAttribute(
    'href',
    '/claims?status=SETTLED_PAYMENT_OUTSTANDING',
  );
  expect(screen.getByRole('link', { name: 'GHS 4' })).toHaveAttribute(
    'href',
    '/claims?currency=GHS',
  );
  expect(screen.getByRole('link', { name: /Explore the register/ })).toHaveAttribute(
    'href',
    '/claims',
  );
});
it('does not show a false zero when loading fails', async () => {
  mocks.request.mockRejectedValue(new Error('Unable to load claims'));
  render(<Dashboard />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load claims');
  expect(screen.getByText('Financial overview is unavailable.')).toBeInTheDocument();
});
it('does not fetch or expose claims without permission', () => {
  mocks.allowed = false;
  render(<Dashboard />);
  expect(mocks.request).not.toHaveBeenCalled();
  expect(screen.queryByRole('region', { name: 'Portfolio overview' })).not.toBeInTheDocument();
});
