import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
import {
  cancelPayableBodySchema,
  claimPayableParamsSchema,
  payableBodySchema,
  payableParamsSchema,
} from './payables.schemas.js';
/** @param {{controller:import('./payables.controller.js').PayablesController,authenticate:import('express').RequestHandler,csrfProtection:import('express').RequestHandler}} input */
export function createPayablesRouter({ controller, authenticate, csrfProtection }) {
  const router = Router();
  router.use(authenticate);
  router.get(
    '/claims/:claimId/payables',
    requirePermission('payables.view'),
    validate({ params: claimPayableParamsSchema }),
    controller.list,
  );
  router.post(
    '/claims/:claimId/payables',
    csrfProtection,
    requirePermission('payables.create'),
    validate({ params: claimPayableParamsSchema, body: payableBodySchema }),
    controller.create,
  );
  router.post(
    '/payables/:id/approve',
    csrfProtection,
    requirePermission('payables.approve'),
    validate({ params: payableParamsSchema }),
    controller.approve,
  );
  router.post(
    '/payables/:id/cancel',
    csrfProtection,
    requirePermission('payables.cancel'),
    validate({ params: payableParamsSchema, body: cancelPayableBodySchema }),
    controller.cancel,
  );
  return router;
}
