export class ReferenceController {
  /** @param {import('./reference.service.js').ReferenceService} service */
  constructor(service) {
    this.service = service;
  }
  /** @type {import('express').RequestHandler} */
  currencies = async (_req, res, next) => {
    try {
      return res.json({ data: await this.service.listCurrencies() });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  parties = async (req, res, next) => {
    try {
      return res.json({
        data: await this.service.searchParties(
          /** @type {{q:string,limit:number}} */ (req.validatedQuery),
        ),
      });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  policies = async (req, res, next) => {
    try {
      return res.json({
        data: await this.service.searchPolicies(
          /** @type {{q:string,limit:number}} */ (req.validatedQuery),
        ),
      });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  createParty = async (req, res, next) => {
    try {
      return res.status(201).json({ data: await this.service.createParty(req.body, context(req)) });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  createPolicy = async (req, res, next) => {
    try {
      return res
        .status(201)
        .json({ data: await this.service.createPolicy(req.body, context(req)) });
    } catch (e) {
      return next(e);
    }
  };
}
/** @param {import('express').Request} request */
function context(request) {
  return { userId: request.auth?.user.id ?? '', correlationId: String(request.id) };
}
