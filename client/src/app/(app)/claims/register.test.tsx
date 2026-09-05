import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { ClaimsRegister, waitForReportCompletion } from './register';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  search: 'currency=GHS',
  canExport: true,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/claims',
}));

vi.mock('@/lib/auth', () => ({
  usePermission: () => navigation.canExport,
}));

const claimsPayload = {
  data: [
    {
      id: '1',
      claimNumber: 'CLM-2026-000001',
      policyNumberSnapshot: 'POL-00001',
      insuredNameSnapshot: 'Ama Mensah',
      lossDate: '2026-08-01',
      notificationDate: '2026-08-02',
      lossNature: 'Collision',
      currencyCode: 'GHS',
      estimatedLossAmount: '12500.5',
      approvedAmount: '10000',
      paidAmount: '8200',
      outstandingAmount: '1800',
      financialStatus: 'RESERVED_NOT_SETTLED',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
  summaries: [
    {
      currencyCode: 'GHS',
      claimCount: 1,
      estimatedLoss: '12500.5',
      approvedAmount: '10000',
      paidAmount: '8200',
      outstandingAmount: '1800',
    },
  ],
};

describe('ClaimsRegister', () => {
  beforeEach(() => {
    navigation.push.mockReset();
    navigation.search = 'currency=GHS';
    navigation.canExport = true;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const payload = String(url).includes('/currencies') ? { data: [] } : claimsPayload;
        return Promise.resolve({ ok: true, status: 200, json: async () => payload });
      }),
    );
  });

  it('renders filtered rows and currency summaries from the API', async () => {
    render(
      <ToastProvider>
        <ClaimsRegister />
      </ToastProvider>,
    );
    expect(await screen.findByText('CLM-2026-000001')).toBeInTheDocument();
    expect(screen.getAllByText('GHS 12,500.50')).toHaveLength(2);
    // Appears both as a filter option and as the row's status badge.
    expect(screen.getAllByText('Reserved, not settled')).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/claims?currency=GHS'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('omits blank filter values when applying filters', async () => {
    render(
      <ToastProvider>
        <ClaimsRegister />
      </ToastProvider>,
    );
    await screen.findByText('CLM-2026-000001');

    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(navigation.push).toHaveBeenCalledWith('/claims');
  });

  it('hides export when the user lacks the export permission', async () => {
    navigation.canExport = false;
    render(
      <ToastProvider>
        <ClaimsRegister />
      </ToastProvider>,
    );

    await screen.findByText('CLM-2026-000001');
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });

  it('stops waiting when an export remains pending beyond the polling limit', async () => {
    const readStatus = vi.fn().mockResolvedValue({ status: 'PROCESSING' });

    await expect(waitForReportCompletion(readStatus, () => Promise.resolve(), 2)).rejects.toThrow(
      'The export is still being prepared. Please try again shortly.',
    );
    expect(readStatus).toHaveBeenCalledTimes(2);
  });
});
