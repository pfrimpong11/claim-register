import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { zero } from './reconciliation.repository.js';

export class ReconciliationService {
  /** @param {{repository:import('./reconciliation.repository.js').ReconciliationRepository,auditService:import('../audit/audit.service.js').AuditService,csvImport:import('./csv-import.service.js').CsvImportService,importsDirectory:string}} input */
  constructor({ repository, auditService, csvImport, importsDirectory }) {
    this.repository = repository;
    this.auditService = auditService;
    this.csvImport = csvImport;
    this.importsDirectory = importsDirectory;
  }
  listImports() {
    return this.repository.listImports();
  }
  /** @param {import('zod').infer<typeof import('./reconciliation.schemas.js').transactionQuerySchema>} query */ async listTransactions(
    query,
  ) {
    const result = await this.repository.listTransactions(query);
    return {
      data: result.rows.map(serializeExternal),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total },
    };
  }
  async listPayments() {
    return (await this.repository.listPayments()).map(serializePayment);
  }
  /** @param {Express.Multer.File|undefined} file @param {ImportInput} input @param {Context} context */ async createImport(
    file,
    input,
    context,
  ) {
    if (!file?.buffer)
      throw new AppError({
        code: 'CSV_FILE_REQUIRED',
        message: 'A CSV file is required.',
        status: 400,
      });
    if (!file.originalname.toLowerCase().endsWith('.csv'))
      throw new AppError({
        code: 'CSV_FILE_INVALID',
        message: 'Only CSV files are accepted.',
        status: 400,
      });
    const account = await this.repository.account(input.settlementAccountId);
    if (!account)
      throw new AppError({
        code: 'SETTLEMENT_ACCOUNT_NOT_FOUND',
        message: 'Settlement account not found.',
        status: 404,
      });
    validateSource(account.accountType, input.sourceType);
    await fs.mkdir(this.importsDirectory, { recursive: true });
    const storagePath = path.join(this.importsDirectory, `${randomUUID()}.csv`);
    await fs.writeFile(storagePath, file.buffer, { flag: 'wx' });
    let item;
    try {
      item = await this.repository.createImport({
        sourceType: input.sourceType,
        settlementAccountId: account.id,
        sourceFileName: path.basename(file.originalname).slice(0, 255),
        storagePath,
        importedBy: context.userId,
      });
      await this.csvImport.enqueue(item.id);
      return item;
    } catch (error) {
      await fs.unlink(storagePath).catch(() => {});
      throw error;
    }
  }
  /** @param {MatchInput} input @param {Context} context */ match(input, context) {
    return this.repository.transaction(async (tx) => {
      const replay = await resolveIdempotency(
        this.repository,
        tx,
        'RECONCILIATION_MATCH',
        context,
        input,
      );
      if (replay) return replay;
      const payment = await this.repository.lockPayment(tx, input.paymentId);
      const external = await this.repository.lockExternal(tx, input.externalTransactionId);
      if (!payment || payment.status !== 'SUCCESSFUL')
        throw new AppError({
          code: 'PAYMENT_NOT_RECONCILABLE',
          message: 'Only a successful payment can be matched.',
          status: 409,
        });
      if (!external)
        throw new AppError({
          code: 'EXTERNAL_TRANSACTION_NOT_FOUND',
          message: 'External transaction not found.',
          status: 404,
        });
      if (external.transactionType !== 'DEBIT')
        throw new AppError({
          code: 'TRANSACTION_DIRECTION_MISMATCH',
          message: 'Payments can only be matched to debit transactions.',
          status: 409,
        });
      if (
        payment.settlementAccountId !== external.settlementAccountId ||
        payment.paymentCurrencyCode !== external.currencyCode
      )
        throw new AppError({
          code: 'RECONCILIATION_INCOMPATIBLE',
          message:
            'Payment and external transaction must use the same settlement account and currency.',
          status: 409,
        });
      const amount = new Prisma.Decimal(input.matchedAmount);
      const paymentMatched = sumMatches(payment.reconciliationMatches);
      const externalMatched = sumMatches(external.matches);
      if (
        amount.gt(payment.paymentAmount.minus(paymentMatched)) ||
        amount.gt(external.amount.minus(externalMatched))
      )
        throw new AppError({
          code: 'RECONCILIATION_EXCEEDS_UNMATCHED',
          message: 'The match exceeds the unmatched amount on the payment or external transaction.',
          status: 409,
        });
      const match = await this.repository.createMatch(tx, {
        paymentId: payment.id,
        externalTransactionId: external.id,
        matchedAmount: amount,
        currencyCode: external.currencyCode,
        matchedBy: context.userId,
        notes: input.notes,
      });
      await this.repository.updateExternalStatus(
        tx,
        external.id,
        statusFor(external.amount, externalMatched.plus(amount)),
      );
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'RECONCILIATION_MATCHED',
        entityType: 'RECONCILIATION_MATCH',
        entityId: match.id,
        claimId: payment.claimId,
        correlationId: context.correlationId,
        newValues: {
          paymentId: payment.id,
          externalTransactionId: external.id,
          matchedAmount: amount.toString(),
          currencyCode: external.currencyCode,
        },
      });
      const result = serializeMatch(match);
      await saveIdempotency(this.repository, tx, 'RECONCILIATION_MATCH', context, input, result);
      return result;
    });
  }
  /** @param {string} id @param {UnmatchInput} input @param {Context} context */ unmatch(
    id,
    input,
    context,
  ) {
    return this.repository.transaction(async (tx) => {
      const request = { id, ...input };
      const replay = await resolveIdempotency(
        this.repository,
        tx,
        'RECONCILIATION_UNMATCH',
        context,
        request,
      );
      if (replay) return replay;
      const match = await this.repository.lockMatch(tx, id);
      if (!match)
        throw new AppError({
          code: 'RECONCILIATION_MATCH_NOT_FOUND',
          message: 'Reconciliation match not found.',
          status: 404,
        });
      if (match.status !== 'ACTIVE')
        throw new AppError({
          code: 'RECONCILIATION_STATE_CONFLICT',
          message: 'This match has already been reversed.',
          status: 409,
        });
      const external = await this.repository.lockExternal(tx, match.externalTransactionId);
      if (!external)
        throw new AppError({
          code: 'EXTERNAL_TRANSACTION_NOT_FOUND',
          message: 'External transaction not found.',
          status: 404,
        });
      const updated = await this.repository.updateMatch(tx, id, {
        status: 'REVERSED',
        reversedBy: context.userId,
        reversedAt: new Date(),
        reversalReason: input.reason,
      });
      const remaining =
        (await this.repository.activeExternalMatched(tx, match.externalTransactionId))._sum
          .matchedAmount ?? zero();
      await this.repository.updateExternalStatus(
        tx,
        match.externalTransactionId,
        statusFor(external.amount, remaining),
      );
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'RECONCILIATION_UNMATCHED',
        entityType: 'RECONCILIATION_MATCH',
        entityId: id,
        claimId: match.payment.claimId,
        correlationId: context.correlationId,
        oldValues: { status: 'ACTIVE' },
        newValues: { status: 'REVERSED', reason: input.reason },
      });
      const result = serializeMatch(updated);
      await saveIdempotency(
        this.repository,
        tx,
        'RECONCILIATION_UNMATCH',
        context,
        request,
        result,
      );
      return result;
    });
  }
}
/** @param {import('@prisma/client').SettlementAccountType} accountType @param {import('@prisma/client').ExternalTransactionSource} sourceType */ function validateSource(
  accountType,
  sourceType,
) {
  const expected =
    /** @type {Partial<Record<import('@prisma/client').SettlementAccountType,import('@prisma/client').ExternalTransactionSource>>} */ ({
      BANK: 'BANK_STATEMENT',
      MOBILE_MONEY: 'MOMO_STATEMENT',
      PAYMENT_GATEWAY: 'GATEWAY_WEBHOOK',
    })[accountType];
  if (expected && sourceType !== expected && sourceType !== 'MANUAL_IMPORT')
    throw new AppError({
      code: 'IMPORT_SOURCE_MISMATCH',
      message: 'The import source does not match the settlement account type.',
      status: 409,
    });
}
/** @param {Array<{matchedAmount:Prisma.Decimal}>} matches */ function sumMatches(matches) {
  return matches.reduce((sum, match) => sum.plus(match.matchedAmount), zero());
}
/** @param {Prisma.Decimal} total @param {Prisma.Decimal} matched @returns {import('@prisma/client').ReconciliationStatus} */ function statusFor(
  total,
  matched,
) {
  return matched.eq(0) ? 'UNMATCHED' : matched.gte(total) ? 'MATCHED' : 'PARTIALLY_MATCHED';
}
/** @param {any} row */ function serializeExternal(row) {
  const matchedAmount = sumMatches(row.matches);
  return {
    ...row,
    amount: row.amount.toString(),
    matchedAmount: matchedAmount.toString(),
    unmatchedAmount: row.amount.minus(matchedAmount).toString(),
    matches: row.matches.map(serializeMatch),
  };
}
/** @param {any} row */ function serializePayment(row) {
  const matchedAmount = sumMatches(row.reconciliationMatches);
  return {
    ...row,
    paymentAmount: row.paymentAmount.toString(),
    fxRate: row.fxRate.toString(),
    settlementAmount: row.settlementAmount.toString(),
    matchedAmount: matchedAmount.toString(),
    unmatchedAmount: row.paymentAmount.minus(matchedAmount).toString(),
    reconciliationStatus: statusFor(row.paymentAmount, matchedAmount),
  };
}
/** @param {any} row */ function serializeMatch(row) {
  return { ...row, matchedAmount: row.matchedAmount.toString() };
}
/** @param {unknown} value */ function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
/** @param {import('./reconciliation.repository.js').ReconciliationRepository} repository @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} scope @param {Context} context @param {unknown} request */ async function resolveIdempotency(
  repository,
  tx,
  scope,
  context,
  request,
) {
  const existing = await repository.idempotency(tx, scope, context.idempotencyKey, context.userId);
  if (!existing) return null;
  if (existing.requestHash !== hash(request))
    throw new AppError({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'The idempotency key was already used for another request.',
      status: 409,
    });
  return existing.responseBody;
}
/** @param {import('./reconciliation.repository.js').ReconciliationRepository} repository @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} scope @param {Context} context @param {unknown} request @param {unknown} result */ async function saveIdempotency(
  repository,
  tx,
  scope,
  context,
  request,
  result,
) {
  await repository.saveIdempotency(tx, {
    scope,
    key: context.idempotencyKey,
    actorId: context.userId,
    requestHash: hash(request),
    responseCode: 200,
    responseBody: JSON.parse(JSON.stringify(result)),
    expiresAt: new Date(Date.now() + 86400000),
  });
}

/** @typedef {import('zod').infer<typeof import('./reconciliation.schemas.js').importBodySchema>} ImportInput */
/** @typedef {import('zod').infer<typeof import('./reconciliation.schemas.js').matchBodySchema>} MatchInput */
/** @typedef {import('zod').infer<typeof import('./reconciliation.schemas.js').unmatchBodySchema>} UnmatchInput */
/** @typedef {{userId:string,correlationId:string,idempotencyKey:string}} Context */
