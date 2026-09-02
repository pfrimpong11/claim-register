import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimsRegister } from './register';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('currency=GHS') }));

describe('ClaimsRegister', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
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
              financialStatus: 'RESERVED_NOT_SETTLED',
            },
          ],
          meta: { total: 1, page: 1, totalPages: 1 },
          summaries: [{ currencyCode: 'GHS', claimCount: 1, estimatedLoss: '12500.5' }],
        }),
      }),
    );
  });
  it('renders filtered rows and currency summaries from the API', async () => {
    render(<ClaimsRegister />);
    expect(await screen.findByText('CLM-2026-000001')).toBeInTheDocument();
    expect(screen.getAllByText('GHS 12500.5')).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/claims?currency=GHS'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
