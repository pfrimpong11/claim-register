import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
import {
  idempotencyHeadersSchema,
  payablePaymentParamsSchema,
  paymentBodySchema,
  paymentParamsSchema,
  reversalBodySchema,
} from './payments.schemas.js';
/** @param {{controller:import('./payments.controller.js').PaymentsController,authenticate:import('express').RequestHandler,csrfProtection:import('express').RequestHandler}} input */
export function createPaymentsRouter({ controller, authenticate, csrfProtection }) {
  const router = Router();
  router.use(authenticate);
  router.get('/settlement-accounts', requirePermission('payments.view'), controller.accounts);
  router.get(
    '/payables/:payableId/payments',
    requirePermission('payments.view'),
    validate({ params: payablePaymentParamsSchema }),
    controller.list,
  );
  router.post(
    '/payables/:payableId/payments',
    csrfProtection,
    requirePermission('payments.create'),
    validate({
      params: payablePaymentParamsSchema,
      body: paymentBodySchema,
      headers: idempotencyHeadersSchema,
    }),
    controller.create,
  );
  router.post(
    '/payments/:id/approve',
    csrfProtection,
    requirePermission('payments.approve'),
    validate({ params: paymentParamsSchema, headers: idempotencyHeadersSchema }),
    controller.approve,
  );
  router.post(
    '/payments/:id/mark-successful',
    csrfProtection,
    requirePermission('payments.succeed'),
    validate({ params: paymentParamsSchema, headers: idempotencyHeadersSchema }),
    controller.succeed,
  );
  router.post(
    '/payments/:id/reverse',
    csrfProtection,
    requirePermission('payments.reverse'),
    validate({
      params: paymentParamsSchema,
      body: reversalBodySchema,
      headers: idempotencyHeadersSchema,
    }),
    controller.reverse,
  );
  return router;
}
