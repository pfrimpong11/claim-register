export class ReconciliationController {
  /** @param {import('./reconciliation.service.js').ReconciliationService} service */ constructor(
    service,
  ) {
    this.service = service;
  }
  /** @type {import('express').RequestHandler} */ listImports = async (_req, res, next) => {
    try {
      return res.json({ data: await this.service.listImports() });
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */ listTransactions = async (req, res, next) => {
    try {
      return res.json(
        await this.service.listTransactions(
          /** @type {import('zod').infer<typeof import('./reconciliation.schemas.js').transactionQuerySchema>} */ (
            req.validatedQuery
          ),
        ),
      );
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */ listPayments = async (_req, res, next) => {
    try {
      return res.json({ data: await this.service.listPayments() });
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */ createImport = async (req, res, next) => {
    try {
      return res
        .status(202)
        .json({ data: await this.service.createImport(req.file, req.body, context(req, false)) });
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */ match = async (req, res, next) => {
    try {
      return res.status(201).json({ data: await this.service.match(req.body, context(req, true)) });
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */ unmatch = async (req, res, next) => {
    try {
      return res.json({
        data: await this.service.unmatch(String(req.params.id), req.body, context(req, true)),
      });
    } catch (error) {
      return next(error);
    }
  };
}
/** @param {import('express').Request} req @param {boolean} idempotent */ function context(
  req,
  idempotent,
) {
  return {
    userId: req.auth?.user.id ?? '',
    correlationId: String(req.id),
    idempotencyKey: idempotent ? String(req.headers['idempotency-key']) : '',
  };
}
