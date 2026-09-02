import { z } from 'zod';

const decimal = z.string().regex(/^(?!0+(?:\.0+)?$)\d{1,15}(\.\d{1,4})?$/);
export const transactionQuerySchema = z.object({
  status: z.enum(['UNMATCHED', 'PARTIALLY_MATCHED', 'MATCHED']).optional(),
  settlementAccountId: z.string().uuid().optional(),
  sourceType: z
    .enum(['BANK_STATEMENT', 'MOMO_STATEMENT', 'GATEWAY_WEBHOOK', 'MANUAL_IMPORT'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export const importBodySchema = z.object({
  settlementAccountId: z.string().uuid(),
  sourceType: z.enum(['BANK_STATEMENT', 'MOMO_STATEMENT', 'GATEWAY_WEBHOOK', 'MANUAL_IMPORT']),
});
export const matchBodySchema = z.object({
  paymentId: z.string().uuid(),
  externalTransactionId: z.string().uuid(),
  matchedAmount: decimal,
  notes: z.string().trim().max(500).optional().nullable(),
});
export const matchParamsSchema = z.object({ id: z.string().uuid() });
export const unmatchBodySchema = z.object({ reason: z.string().trim().min(5).max(500) });
export const csvRowSchema = z.object({
  externalReference: z.string().trim().min(1).max(200),
  transactionDate: z.string().date(),
  valueDate: z.string().date().optional().or(z.literal('')),
  transactionType: z.enum(['DEBIT', 'CREDIT']),
  amount: decimal,
  currencyCode: z
    .string()
    .length(3)
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().max(500).optional(),
});
