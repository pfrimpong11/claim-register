import { fireEvent, render, screen, within } from '@testing-library/react';
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
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => (String(url).includes('/currencies') ? { data: [] } : payload),
        });
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

  it('places a separate currency totals table below the register using full filtered totals', async () => {
    const payload = {
      ...claimsPayload,
      summaries: [
        { ...claimsPayload.summaries[0], claimCount: 12, outstandingAmount: '21600' },
        {
          ...claimsPayload.summaries[0],
          currencyCode: 'USD',
          claimCount: 3,
          outstandingAmount: '900',
        },
      ],
    };
    vi.mocked(fetch).mockImplementation(
      async (url) =>
        ({
          ok: true,
          status: 200,
          json: async () => (String(url).includes('/currencies') ? { data: [] } : payload),
        }) as Response,
    );
    const { container } = render(
      <ToastProvider>
        <ClaimsRegister />
      </ToastProvider>,
    );
    await screen.findByText('CLM-2026-000001');
    const table = screen.getByRole('table', { name: 'Claims totals by currency' });
    expect(screen.getAllByRole('table')[1]).toBe(table);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Currency',
      'Estimated Loss',
      'Approved (Indemnity)',
      'Total Paid',
      'Outstanding',
      'Overpaid',
    ]);
    const ghs = within(table).getByText('GHS', { exact: true }).closest('tr')!;
    expect(within(ghs).getByText('GHS 21,600.00')).toBeInTheDocument();
    expect(within(ghs).queryByText(/USD/)).not.toBeInTheDocument();
    expect(within(table).getByText('USD 900.00')).toBeInTheDocument();
    expect(container.querySelector('article')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('link', { name: 'Create Claim' })).not.toBeInTheDocument();
  });

  it('retains advanced filters when the filter panel is collapsed', async () => {
    render(
      <ToastProvider>
        <ClaimsRegister />
      </ToastProvider>,
    );
    await screen.findByText('CLM-2026-000001');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Policy'), { target: { value: 'POL-00001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(navigation.push).toHaveBeenCalledWith('/claims?currency=GHS&policy=POL-00001');
    expect(screen.getByRole('link', { name: 'Clear all' })).toHaveAttribute('href', '/claims');
  });

  it('stops waiting when an export remains pending beyond the polling limit', async () => {
    const readStatus = vi.fn().mockResolvedValue({ status: 'PROCESSING' });

    await expect(waitForReportCompletion(readStatus, () => Promise.resolve(), 2)).rejects.toThrow(
      'The export is still being prepared. Please try again shortly.',
    );
    expect(readStatus).toHaveBeenCalledTimes(2);
  });
});
