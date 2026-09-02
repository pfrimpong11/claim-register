export class ClaimsController {
  /** @param {import('./claims.service.js').ClaimsService} service */
  constructor(service) {
    this.service = service;
  }
  /** @type {import('express').RequestHandler} */
  create = async (req, res, next) => {
    try {
      return res.status(201).json({
        data: await this.service.create(req.body, {
          userId: req.auth?.user.id ?? '',
          correlationId: String(req.id),
        }),
      });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  list = async (req, res, next) => {
    try {
      return res.json(
        await this.service.list(
          /** @type {import('zod').infer<typeof import('./claims.schemas.js').claimsQuerySchema>} */ (
            req.validatedQuery
          ),
        ),
      );
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */
  get = async (req, res, next) => {
    try {
      return res.json({ data: await this.service.get(String(req.params.id)) });
    } catch (e) {
      return next(e);
    }
  };
}
