import { z } from 'zod';
const decimal = z.string().regex(/^(?!0+(?:\.0+)?$)\d{1,15}(\.\d{1,8})?$/);
export const payablePaymentParamsSchema = z.object({ payableId: z.string().uuid() });
export const paymentParamsSchema = z.object({ id: z.string().uuid() });
const confirmationFields = {
  confirmOverpayment: z.boolean().optional().default(false),
  overpaymentReason: z.string().trim().min(5).max(500).optional(),
};

export const paymentBodySchema = z
  .object({
    paymentDate: z.coerce.date(),
    paymentAmount: decimal,
    paymentCurrencyCode: z
      .string()
      .length(3)
      .transform((v) => v.toUpperCase()),
    fxRate: decimal,
    settlementAccountId: z.string().uuid(),
    reference: z.string().trim().max(200).optional().nullable(),
    ...confirmationFields,
  })
  .superRefine(requireOverpaymentReason);
export const paymentSuccessBodySchema = z
  .object(confirmationFields)
  .superRefine(requireOverpaymentReason)
  .default({ confirmOverpayment: false });
export const reversalBodySchema = z.object({ reason: z.string().trim().min(5).max(500) });
export const idempotencyHeadersSchema = z
  .object({ 'idempotency-key': z.string().trim().min(8).max(200) })
  .passthrough();

/** @param {{confirmOverpayment?:boolean,overpaymentReason?:string}} value @param {z.RefinementCtx} context */
function requireOverpaymentReason(value, context) {
  if (value.confirmOverpayment && !value.overpaymentReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['overpaymentReason'],
      message: 'A reason is required when confirming an overpayment.',
    });
  }
}
