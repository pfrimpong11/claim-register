import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
import { partyBodySchema, policyBodySchema, searchSchema } from './reference.schemas.js';
/** @param {{controller: import('./reference.controller.js').ReferenceController, authenticate: import('express').RequestHandler, csrfProtection: import('express').RequestHandler}} input */
export function createReferenceRouter({ controller, authenticate, csrfProtection }) {
  const router = Router();
  router.use(authenticate);
  router.get('/currencies', controller.currencies);
  router.get(
    '/parties',
    requirePermission('parties.view'),
    validate({ query: searchSchema }),
    controller.parties,
  );
  router.post(
    '/parties',
    csrfProtection,
    requirePermission('parties.create'),
    validate({ body: partyBodySchema }),
    controller.createParty,
  );
  router.get(
    '/policies',
    requirePermission('policies.view'),
    validate({ query: searchSchema }),
    controller.policies,
  );
  router.post(
    '/policies',
    csrfProtection,
    requirePermission('policies.create'),
    validate({ body: policyBodySchema }),
    controller.createPolicy,
  );
  return router;
}
