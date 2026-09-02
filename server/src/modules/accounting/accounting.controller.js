import { AppError } from '../../shared/errors.js';
export class AccountingController {
  /** @param {import('./accounting.repository.js').AccountingRepository} repository */ constructor(
    repository,
  ) {
    this.repository = repository;
  }
  /** @type {import('express').RequestHandler} */ list = async (_req, res, next) => {
    try {
      return res.json({ data: (await this.repository.list()).map(serialize) });
    } catch (e) {
      return next(e);
    }
  };
  /** @type {import('express').RequestHandler} */ get = async (req, res, next) => {
    try {
      const journal = await this.repository.get(String(req.params.id));
      if (!journal)
        throw new AppError({
          code: 'JOURNAL_NOT_FOUND',
          message: 'Journal not found.',
          status: 404,
        });
      return res.json({ data: serialize(journal) });
    } catch (e) {
      return next(e);
    }
  };
}
/** @param {{lines:Array<{debitAmount:import('@prisma/client').Prisma.Decimal,creditAmount:import('@prisma/client').Prisma.Decimal} & Record<string,unknown>>} & Record<string,unknown>} journal */
function serialize(journal) {
  return {
    ...journal,
    lines: journal.lines.map((line) => ({
      ...line,
      debitAmount: line.debitAmount.toString(),
      creditAmount: line.creditAmount.toString(),
    })),
  };
}
