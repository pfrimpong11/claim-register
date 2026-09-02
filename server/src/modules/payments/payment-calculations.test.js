import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateSettlement, deriveFinancialPosition } from './payment-calculations.js';
describe('payment calculations', () => {
  it('uses the canonical rate and half-up claim-currency rounding', () => {
    expect(
      calculateSettlement({
        paymentAmount: '10.005',
        paymentCurrencyCode: 'USD',
        fxRate: '1',
        settlementCurrencyCode: 'GHS',
        decimalPlaces: 2,
      }).toString(),
    ).toBe('10.01');
  });
  it('requires rate one for same-currency payments and derives all statuses', () => {
    expect(() =>
      calculateSettlement({
        paymentAmount: '10',
        paymentCurrencyCode: 'GHS',
        fxRate: '1.1',
        settlementCurrencyCode: 'GHS',
        decimalPlaces: 2,
      }),
    ).toThrow('FX rate of 1');
    expect(deriveFinancialPosition(new Prisma.Decimal(0), new Prisma.Decimal(0)).status).toBe(
      'RESERVED_NOT_SETTLED',
    );
    expect(deriveFinancialPosition(new Prisma.Decimal(100), new Prisma.Decimal(40)).status).toBe(
      'SETTLED_PAYMENT_OUTSTANDING',
    );
    expect(deriveFinancialPosition(new Prisma.Decimal(100), new Prisma.Decimal(100)).status).toBe(
      'SETTLED_AND_PAID',
    );
  });
});
