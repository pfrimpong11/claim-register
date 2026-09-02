export class PaymentsController {
  /** @param {import('./payments.service.js').PaymentsService} service */ constructor(service) {
    this.service = service;
  }
  /** @type {import('express').RequestHandler} */ list = async (req, res, next) => {
    try {
      return res.json({ data: await this.service.list(String(req.params.payableId)) });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */ accounts = async (_req, res, next) => {
    try {
      return res.json({ data: await this.service.settlementAccounts() });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */ create = async (req, res, next) => {
    try {
      return res.status(201).json({
        data: await this.service.create(String(req.params.payableId), req.body, context(req)),
      });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */ approve = async (req, res, next) => {
    try {
      return res.json({ data: await this.service.approve(String(req.params.id), context(req)) });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */ succeed = async (req, res, next) => {
    try {
      return res.json({ data: await this.service.succeed(String(req.params.id), context(req)) });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */ reverse = async (req, res, next) => {
    try {
      return res.json({
        data: await this.service.reverse(String(req.params.id), req.body, context(req)),
      });
    } catch (e) {
      return next(e);
    }
  };
}
/** @param {import('express').Request} req */ function context(req) {
  return {
    userId: req.auth?.user.id ?? '',
    correlationId: String(req.id),
    idempotencyKey: String(req.headers['idempotency-key']),
  };
}
