import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
/** @param {{controller:import('./accounting.controller.js').AccountingController,authenticate:import('express').RequestHandler}} input */
export function createAccountingRouter({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, requirePermission('accounting.view'));
  router.get('/accounting/journals', controller.list);
  router.get(
    '/accounting/journals/:id',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    controller.get,
  );
  return router;
}
