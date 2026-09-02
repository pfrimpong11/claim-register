import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../access/require-permission.js';
import {
  claimDocumentParamsSchema,
  documentBodySchema,
  documentParamsSchema,
} from './documents.schemas.js';

/** @param {{controller: import('./documents.controller.js').DocumentsController,authenticate:import('express').RequestHandler,csrfProtection:import('express').RequestHandler,maxBytes:number}} input */
export function createDocumentsRouter({ controller, authenticate, csrfProtection, maxBytes }) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 2 },
  });
  router.use(authenticate);
  router.get(
    '/claims/:claimId/documents',
    requirePermission('documents.view'),
    validate({ params: claimDocumentParamsSchema }),
    controller.list,
  );
  router.post(
    '/claims/:claimId/documents',
    csrfProtection,
    requirePermission('documents.upload'),
    upload.single('file'),
    validate({ params: claimDocumentParamsSchema, body: documentBodySchema }),
    controller.upload,
  );
  router.get(
    '/documents/:id/download',
    requirePermission('documents.view'),
    validate({ params: documentParamsSchema }),
    controller.download,
  );
  router.post(
    '/documents/:id/deactivate',
    csrfProtection,
    requirePermission('documents.deactivate'),
    validate({ params: documentParamsSchema }),
    controller.deactivate,
  );
  return router;
}
