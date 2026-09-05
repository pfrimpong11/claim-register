import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsTab } from './payments-tab';

const apiRequest = vi.fn();
const apiMutate = vi.fn();
let loadedPayments: unknown[] = [];

vi.mock('@/lib/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  apiMutate: (...args: unknown[]) => apiMutate(...args),
}));
vi.mock('@/lib/auth', () => ({ usePermission: () => true }));
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe('PaymentsTab', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiMutate.mockReset();
    apiMutate.mockResolvedValue(undefined);
    loadedPayments = [];
    apiRequest.mockImplementation((path: string) => {
      if (path === '/settlement-accounts')
        return Promise.resolve({
          data: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              name: 'Claims account',
              accountType: 'BANK',
              currencyCode: 'GHS',
            },
          ],
        });
      if (path.endsWith('/payables'))
        return Promise.resolve({
          data: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              amount: '100',
              currencyCode: 'GHS',
              status: 'APPROVED',
              payee: { id: '33333333-3333-4333-8333-333333333333', displayName: 'Ama Mensah' },
            },
          ],
        });
      if (path.includes('/payments')) return Promise.resolve({ data: loadedPayments });
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('shows the amount and reason confirmation before an excessive draft can be submitted', async () => {
    render(
      <PaymentsTab
        claim={{
          id: '44444444-4444-4444-8444-444444444444',
          claimNumber: 'CLM-1',
          policyNumberSnapshot: 'POL-1',
          insuredNameSnapshot: 'Ama Mensah',
          lossDate: '2026-09-01',
          notificationDate: '2026-09-02',
          lossNature: 'Accident',
          currencyCode: 'GHS',
          estimatedLossAmount: '120',
          approvedAmount: '100',
          paidAmount: '0',
          outstandingAmount: '100',
          financialStatus: 'SETTLED_PAYMENT_OUTSTANDING',
        }}
        onChanged={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Payment' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'New Payment' }));
    fireEvent.change(screen.getByLabelText(/^Payable/), {
      target: { value: '22222222-2222-4222-8222-222222222222' },
    });
    fireEvent.change(screen.getByLabelText(/^Payment Currency/), { target: { value: 'GHS' } });

    expect(screen.getByText('Selected payable outstanding').parentElement).toHaveTextContent(
      'GHS 100.00',
    );
    expect(screen.getByText('Entire claim outstanding').parentElement).toHaveTextContent(
      'GHS 100.00',
    );
    expect(screen.getByText('Amount required to settle').parentElement).toHaveTextContent(
      'GHS 100.00',
    );

    fireEvent.change(screen.getByLabelText(/^Payment Amount/), { target: { value: '60' } });
    expect(
      screen.getByText('GHS 40.00 will remain outstanding on the selected payable.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Payment Amount/), { target: { value: '100' } });
    expect(
      screen.getByText('This payment will fully settle the selected payable.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Payment Amount/), { target: { value: '150' } });

    expect(screen.getByText('Potential overpayment')).toBeInTheDocument();
    expect(screen.getByText(/exceeds.*GHS 50.00/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText('I confirm this is an intentional record of an external overpayment.'),
    ).toBeRequired();
    expect(screen.getByLabelText(/^Reason for overpayment/)).toBeRequired();
  });

  it('passes the entered reason when confirming an existing overpayment draft', async () => {
    loadedPayments = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        paymentNumber: 'PAY-2026-000003',
        status: 'APPROVED',
        paymentDate: '2026-09-03',
        paymentAmount: '5000',
        paymentCurrencyCode: 'USD',
        fxRate: '12',
        settlementAmount: '60000',
        settlementCurrencyCode: 'GHS',
        settlementAccount: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Claims account',
          accountType: 'BANK',
          currencyCode: 'GHS',
        },
        reconciliationStatus: 'UNMATCHED',
        reconciliationMatchedAmount: '0',
        reconciliationUnmatchedAmount: '60000',
      },
    ];

    render(
      <PaymentsTab
        claim={{
          id: '44444444-4444-4444-8444-444444444444',
          claimNumber: 'CLM-1',
          policyNumberSnapshot: 'POL-1',
          insuredNameSnapshot: 'Ama Mensah',
          lossDate: '2026-09-01',
          notificationDate: '2026-09-02',
          lossNature: 'Accident',
          currencyCode: 'GHS',
          estimatedLossAmount: '12000',
          approvedAmount: '10000',
          paidAmount: '0',
          outstandingAmount: '10000',
          financialStatus: 'SETTLED_PAYMENT_OUTSTANDING',
        }}
        onChanged={vi.fn()}
      />,
    );

    const markSuccessful = await screen.findByRole('button', { name: 'Mark successful' });
    fireEvent.click(markSuccessful);
    fireEvent.change(screen.getByLabelText(/^Reason for recording this overpayment/), {
      target: { value: 'Actual external transfer exceeded the payable.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(apiMutate).toHaveBeenCalledWith(
        '/payments/55555555-5555-4555-8555-555555555555/mark-successful',
        expect.objectContaining({
          body: {
            confirmOverpayment: true,
            overpaymentReason: 'Actual external transfer exceeded the payable.',
          },
        }),
      ),
    );
  });
});
