import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
import { auditQuerySchema } from './audit.schemas.js';
/** @param {{controller:import('./audit.controller.js').AuditController,authenticate:import('express').RequestHandler}} input */ export function createAuditRouter({
  controller,
  authenticate,
}) {
  const router = Router();
  router.use(authenticate);
  router.get(
    '/audit-logs',
    requirePermission('audit.view'),
    validate({ query: auditQuerySchema }),
    controller.list,
  );
  return router;
}
