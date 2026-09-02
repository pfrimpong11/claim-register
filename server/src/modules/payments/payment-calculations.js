import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors.js';

/** @param {{paymentAmount:string,paymentCurrencyCode:string,fxRate:string,settlementCurrencyCode:string,decimalPlaces:number}} input */
export function calculateSettlement(input) {
  const amount = new Prisma.Decimal(input.paymentAmount);
  const rate = new Prisma.Decimal(input.fxRate);
  if (amount.lte(0) || rate.lte(0))
    throw new AppError({
      code: 'INVALID_PAYMENT_VALUE',
      message: 'Payment amount and FX rate must be positive.',
      status: 422,
    });
  if (input.paymentCurrencyCode === input.settlementCurrencyCode && !rate.equals(1))
    throw new AppError({
      code: 'SAME_CURRENCY_FX_MUST_BE_ONE',
      message: 'Same-currency payments must use an FX rate of 1.',
      status: 422,
    });
  return amount.times(rate).toDecimalPlaces(input.decimalPlaces, Prisma.Decimal.ROUND_HALF_UP);
}

/** @param {import('@prisma/client').Prisma.Decimal} approved @param {import('@prisma/client').Prisma.Decimal} paid @returns {{approved:import('@prisma/client').Prisma.Decimal,paid:import('@prisma/client').Prisma.Decimal,outstanding:import('@prisma/client').Prisma.Decimal,status:import('@prisma/client').ClaimFinancialStatus}} */
export function deriveFinancialPosition(approved, paid) {
  const outstanding = Prisma.Decimal.max(approved.minus(paid), 0);
  /** @type {import('@prisma/client').ClaimFinancialStatus} */
  const status = approved.isZero()
    ? 'RESERVED_NOT_SETTLED'
    : outstanding.isZero()
      ? 'SETTLED_AND_PAID'
      : 'SETTLED_PAYMENT_OUTSTANDING';
  return { approved, paid, outstanding, status };
}
