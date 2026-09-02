import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
import { idempotencyHeadersSchema } from '../payments/payments.schemas.js';
import {
  importBodySchema,
  matchBodySchema,
  matchParamsSchema,
  transactionQuerySchema,
  unmatchBodySchema,
} from './reconciliation.schemas.js';

/** @param {{controller:import('./reconciliation.controller.js').ReconciliationController,authenticate:import('express').RequestHandler,csrfProtection:import('express').RequestHandler}} input */
export function createReconciliationRouter({ controller, authenticate, csrfProtection }) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 2 },
  });
  router.use(authenticate);
  router.get(
    '/transaction-imports',
    requirePermission('reconciliation.view'),
    controller.listImports,
  );
  router.post(
    '/transaction-imports',
    csrfProtection,
    requirePermission('reconciliation.import'),
    upload.single('file'),
    validate({ body: importBodySchema }),
    controller.createImport,
  );
  router.get(
    '/external-transactions',
    requirePermission('reconciliation.view'),
    validate({ query: transactionQuerySchema }),
    controller.listTransactions,
  );
  router.get(
    '/reconciliation-payments',
    requirePermission('reconciliation.view'),
    controller.listPayments,
  );
  router.post(
    '/reconciliation-matches',
    csrfProtection,
    requirePermission('reconciliation.match'),
    validate({ body: matchBodySchema, headers: idempotencyHeadersSchema }),
    controller.match,
  );
  router.post(
    '/reconciliation-matches/:id/reverse',
    csrfProtection,
    requirePermission('reconciliation.unmatch'),
    validate({
      params: matchParamsSchema,
      body: unmatchBodySchema,
      headers: idempotencyHeadersSchema,
    }),
    controller.unmatch,
  );
  return router;
}
