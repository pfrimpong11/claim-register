import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
import { claimBodySchema, claimParamsSchema, claimsQuerySchema } from './claims.schemas.js';
/** @param {{controller: import('./claims.controller.js').ClaimsController, authenticate: import('express').RequestHandler, csrfProtection: import('express').RequestHandler}} input */
export function createClaimsRouter({ controller, authenticate, csrfProtection }) {
  const router = Router();
  router.use(authenticate);
  router.get(
    '/',
    requirePermission('claims.view'),
    validate({ query: claimsQuerySchema }),
    controller.list,
  );
  router.post(
    '/',
    csrfProtection,
    requirePermission('claims.create'),
    validate({ body: claimBodySchema }),
    controller.create,
  );
  router.get(
    '/:id',
    requirePermission('claims.view'),
    validate({ params: claimParamsSchema }),
    controller.get,
  );
  return router;
}
