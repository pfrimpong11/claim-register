import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
import { claimsQuerySchema } from '../claims/claims.schemas.js';
const params = z.object({ id: z.string().uuid() });
/** @param {{controller:import('./reports.controller.js').ReportsController,authenticate:import('express').RequestHandler,csrfProtection:import('express').RequestHandler}} input */
export function createReportsRouter({ controller, authenticate, csrfProtection }) {
  const router = Router();
  router.use(authenticate);
  router.post(
    '/reports/claims-exports',
    csrfProtection,
    requirePermission('reports.export'),
    validate({ query: claimsQuerySchema }),
    controller.create,
  );
  router.get(
    '/reports/claims-exports/:id',
    requirePermission('reports.export'),
    validate({ params }),
    controller.status,
  );
  router.get(
    '/reports/claims-exports/:id/download',
    requirePermission('reports.export'),
    validate({ params }),
    controller.download,
  );
  return router;
}
