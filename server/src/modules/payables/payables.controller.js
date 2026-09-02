export class PayablesController {
  /** @param {import('./payables.service.js').PayablesService} service */ constructor(service) {
    this.service = service;
  }
  /** @type {import('express').RequestHandler} */
  list = async (req, res, next) => {
    try {
      return res.json({ data: await this.service.list(String(req.params.claimId)) });
    } catch (e) {
      next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  create = async (req, res, next) => {
    try {
      return res.status(201).json({
        data: await this.service.create(String(req.params.claimId), req.body, context(req)),
      });
    } catch (e) {
      next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  approve = async (req, res, next) => {
    try {
      return res.json({ data: await this.service.approve(String(req.params.id), context(req)) });
    } catch (e) {
      next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  cancel = async (req, res, next) => {
    try {
      return res.json({
        data: await this.service.cancel(String(req.params.id), req.body, context(req)),
      });
    } catch (e) {
      next(e);
    }
  };
}
/** @param {import('express').Request} req */
function context(req) {
  return { userId: req.auth?.user.id ?? '', correlationId: String(req.id) };
}
