import { z } from 'zod';

export const claimPayableParamsSchema = z.object({ claimId: z.string().uuid() });
export const payableParamsSchema = z.object({ id: z.string().uuid() });
export const payableBodySchema = z.object({
  payeePartyId: z.string().uuid(),
  amount: z.string().regex(/^(?!0+(?:\.0+)?$)\d{1,15}(\.\d{1,4})?$/),
  description: z.string().trim().max(500).optional().nullable(),
});
export const cancelPayableBodySchema = z.object({ reason: z.string().trim().min(5).max(500) });
