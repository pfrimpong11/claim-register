import { z } from 'zod';
export const claimBodySchema = z
  .object({
    policyId: z.string().uuid(),
    lossDate: z.coerce.date(),
    notificationDate: z.coerce.date(),
    notificationOverrideReason: z.string().trim().min(5).max(500).optional().nullable(),
    lossNature: z.string().trim().min(2).max(150),
    description: z.string().trim().max(2000).optional().nullable(),
    estimatedLossAmount: z.string().regex(/^\d{1,15}(\.\d{1,4})?$/),
  })
  .refine((v) => v.notificationDate >= v.lossDate || Boolean(v.notificationOverrideReason), {
    message: 'An override reason is required when notification precedes loss.',
    path: ['notificationOverrideReason'],
  });
export const claimsQuerySchema = z.object({
  search: z.string().trim().max(100).default(''),
  currency: z.string().length(3).optional(),
  policy: z.string().trim().max(100).optional(),
  insured: z.string().trim().max(200).optional(),
  status: z
    .enum(['RESERVED_NOT_SETTLED', 'SETTLED_PAYMENT_OUTSTANDING', 'SETTLED_AND_PAID'])
    .optional(),
  lossNature: z.string().trim().max(150).optional(),
  lossFrom: z.coerce.date().optional(),
  lossTo: z.coerce.date().optional(),
  notificationFrom: z.coerce.date().optional(),
  notificationTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['lossDate', 'notificationDate', 'claimNumber']).default('lossDate'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
export const claimParamsSchema = z.object({ id: z.string().uuid() });
