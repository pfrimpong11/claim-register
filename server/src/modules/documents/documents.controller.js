export class DocumentsController {
  /** @param {import('./documents.service.js').DocumentsService} service */
  constructor(service) {
    this.service = service;
  }
  /** @type {import('express').RequestHandler} */
  list = async (req, res, next) => {
    try {
      return res.json({ data: await this.service.list(String(req.params.claimId)) });
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */
  upload = async (req, res, next) => {
    try {
      return res.status(201).json({
        data: await this.service.upload(
          String(req.params.claimId),
          req.file,
          req.body,
          context(req),
        ),
      });
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */
  download = async (req, res, next) => {
    try {
      const { document, stream } = await this.service.download(String(req.params.id));
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Length', document.fileSizeBytes.toString());
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFileName}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      stream.on('error', next);
      return stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  };
  /** @type {import('express').RequestHandler} */
  deactivate = async (req, res, next) => {
    try {
      await this.service.deactivate(String(req.params.id), context(req));
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  };
}
/** @param {import('express').Request} req */
function context(req) {
  return { userId: req.auth?.user.id ?? '', correlationId: String(req.id) };
}
