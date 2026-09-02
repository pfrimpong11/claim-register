import { z } from 'zod';

export const claimDocumentParamsSchema = z.object({ claimId: z.string().uuid() });
export const documentParamsSchema = z.object({ id: z.string().uuid() });
export const documentBodySchema = z.object({
  documentType: z.enum([
    'CLAIM_FORM',
    'POLICE_REPORT',
    'ID_DOCUMENT',
    'VEHICLE_DOCUMENT',
    'LOSS_PHOTO',
    'ESTIMATE',
    'INVOICE',
    'ADJUSTER_REPORT',
    'PAYMENT_PROOF',
    'OTHER',
  ]),
  description: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().max(500).optional(),
  ),
});
