export class ReportsController {
  /** @param {import('./claims-export.service.js').ClaimsExportService} service */ constructor(
    service,
  ) {
    this.service = service;
  }
  /** @type {import('express').RequestHandler} */ create = async (req, res, next) => {
    try {
      return res.status(202).json({
        data: await this.service.request(
          /** @type {import('zod').infer<typeof import('../claims/claims.schemas.js').claimsQuerySchema>} */ (
            req.validatedQuery
          ),
          req.auth?.user.id ?? '',
        ),
      });
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */ status = async (req, res, next) => {
    try {
      return res.json({
        data: await this.service.status(String(req.params.id), req.auth?.user.id ?? ''),
      });
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */ download = async (req, res, next) => {
    try {
      const { item, stream } = await this.service.download(
        String(req.params.id),
        req.auth?.user.id ?? '',
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${item.fileName}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      stream.on('error', next);
      return stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  };
}
