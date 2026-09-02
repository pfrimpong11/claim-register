import { z } from 'zod';

/** @param {number} max */
const optionalText = (max) => z.string().trim().max(max).optional().nullable();
export const searchSchema = z.object({
  q: z.string().trim().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const partyBodySchema = z.object({
  partyType: z.enum(['PERSON', 'ORGANIZATION']),
  displayName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320).optional().nullable(),
  phone: optionalText(50),
});
export const policyBodySchema = z
  .object({
    policyNumber: z.string().trim().min(2).max(100),
    policyName: optionalText(200),
    insuredPartyId: z.string().uuid(),
    currencyCode: z.string().trim().length(3).toUpperCase(),
    effectiveFrom: z.coerce.date().optional().nullable(),
    effectiveTo: z.coerce.date().optional().nullable(),
  })
  .refine(
    (value) =>
      !value.effectiveFrom || !value.effectiveTo || value.effectiveTo >= value.effectiveFrom,
    { message: 'Effective-to date cannot precede effective-from date.', path: ['effectiveTo'] },
  );
