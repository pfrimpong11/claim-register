export class AuditController {
  /** @param {import('./audit.repository.js').AuditRepository} repository */ constructor(
    repository,
  ) {
    this.repository = repository;
  }
  /** @type {import('express').RequestHandler} */ list = async (req, res, next) => {
    try {
      const query = /** @type {any} */ (req.validatedQuery);
      const result = await this.repository.list(query);
      return res.json({
        data: result.data,
        meta: { page: query.page, pageSize: query.pageSize, total: result.total },
      });
    } catch (error) {
      return next(error);
    }
  };
}
