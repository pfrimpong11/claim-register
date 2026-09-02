import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { calculateSettlement, deriveFinancialPosition } from './payment-calculations.js';

export class PaymentsService {
  /** @param {import('./payments.repository.js').PaymentsRepository} repository @param {import('../audit/audit.service.js').AuditService} auditService */
  constructor(repository, auditService) {
    this.repository = repository;
    this.auditService = auditService;
  }
  /** @param {string} payableId */ list(payableId) {
    return this.repository.list(payableId).then((rows) => rows.map(serialize));
  }
  settlementAccounts() {
    return this.repository.settlementAccounts();
  }
  /** @param {string} payableId @param {import('zod').infer<typeof import('./payments.schemas.js').paymentBodySchema>} input @param {Context} context */
  create(payableId, input, context) {
    return this.repository.transaction(async (tx) => {
      const replay = await resolveIdempotency(this.repository, tx, 'PAYMENT_CREATE', context, {
        payableId,
        ...input,
      });
      if (replay) return replay;
      const payable = await this.repository.lockPayable(tx, payableId);
      if (!payable)
        throw new AppError({
          code: 'PAYABLE_NOT_FOUND',
          message: 'Payable not found.',
          status: 404,
        });
      if (payable.status !== 'APPROVED')
        throw new AppError({
          code: 'PAYABLE_NOT_APPROVED',
          message: 'Only approved payables can receive payments.',
          status: 409,
        });
      const [account, paymentCurrency] = await Promise.all([
        this.repository.account(tx, input.settlementAccountId),
        this.repository.currency(tx, input.paymentCurrencyCode),
      ]);
      if (!account)
        throw new AppError({
          code: 'SETTLEMENT_ACCOUNT_NOT_FOUND',
          message: 'Settlement account not found.',
          status: 404,
        });
      if (!paymentCurrency)
        throw new AppError({
          code: 'PAYMENT_CURRENCY_NOT_FOUND',
          message: 'Payment currency is unavailable.',
          status: 404,
        });
      if (account.currencyCode !== input.paymentCurrencyCode)
        throw new AppError({
          code: 'ACCOUNT_CURRENCY_MISMATCH',
          message: 'The settlement account currency must match the payment currency.',
          status: 422,
        });
      validateScale(input.paymentAmount, paymentCurrency.decimalPlaces, 'Payment amount');
      const settlementAmount = calculateSettlement({
        ...input,
        settlementCurrencyCode: payable.currencyCode,
        decimalPlaces: payable.claim.currency.decimalPlaces,
      });
      const paymentNumber = await this.repository.nextPaymentNumber(
        tx,
        input.paymentDate.getUTCFullYear(),
      );
      const payment = await this.repository.create(tx, {
        paymentNumber,
        claimId: payable.claimId,
        payableId,
        payeePartyId: payable.payeePartyId,
        paymentDate: input.paymentDate,
        paymentAmount: input.paymentAmount,
        paymentCurrencyCode: input.paymentCurrencyCode,
        fxRate: input.fxRate,
        settlementAmount,
        settlementCurrencyCode: payable.currencyCode,
        settlementAccountId: account.id,
        reference: input.reference,
        createdBy: context.userId,
      });
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'PAYMENT_CREATED',
        entityType: 'CLAIM_PAYMENT',
        entityId: payment.id,
        correlationId: context.correlationId,
        newValues: publicPayment(payment),
      });
      const result = serialize(payment);
      await saveIdempotency(
        this.repository,
        tx,
        'PAYMENT_CREATE',
        context,
        { payableId, ...input },
        result,
        201,
      );
      return result;
    });
  }
  /** @param {string} id @param {Context} context */
  approve(id, context) {
    return this.transitionWithIdempotency(id, 'PAYMENT_APPROVE', context, async (tx, payment) => {
      if (payment.status !== 'DRAFT') conflict('Only a draft payment can be approved.');
      const updated = await this.repository.update(tx, id, {
        status: 'APPROVED',
        approvedBy: context.userId,
        approvedAt: new Date(),
      });
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'PAYMENT_APPROVED',
        entityType: 'CLAIM_PAYMENT',
        entityId: id,
        correlationId: context.correlationId,
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'APPROVED' },
      });
      return serialize(updated);
    });
  }
  /** @param {string} id @param {Context} context */
  succeed(id, context) {
    return this.transitionWithIdempotency(id, 'PAYMENT_SUCCEED', context, async (tx, payment) => {
      if (payment.status !== 'APPROVED' && payment.status !== 'PROCESSING')
        conflict('Only an approved or processing payment can succeed.');
      const payable = await this.repository.lockPayable(tx, payment.payableId);
      if (!payable || payable.status !== 'APPROVED')
        conflict('The payable is not available for payment.');
      const paid =
        (await this.repository.paidForPayable(tx, payment.payableId))._sum.settlementAmount ??
        new Prisma.Decimal(0);
      const outstanding = payable.amount.minus(paid);
      if (payment.settlementAmount.gt(outstanding))
        throw new AppError({
          code: 'PAYMENT_EXCEEDS_OUTSTANDING',
          message: 'The settlement amount exceeds the payable outstanding balance.',
          status: 409,
          details: { outstanding: outstanding.toString(), currency: payable.currencyCode },
        });
      const accounts = await this.repository.paymentAccounts(tx);
      const liability = accounts.find((a) => a.code === 'CLAIMS_PAYABLE');
      const asset = accounts.find((a) => a.code === 'SETTLEMENT_ASSETS');
      if (!liability || !asset)
        throw new AppError({
          code: 'GL_CONFIGURATION_INVALID',
          message: 'Required general-ledger accounts are unavailable.',
          status: 503,
        });
      const before = await position(this.repository, tx, payment.claimId);
      const now = new Date();
      const updated = await this.repository.update(tx, id, {
        status: 'SUCCESSFUL',
        succeededBy: context.userId,
        succeededAt: now,
      });
      const journal = await this.repository.createJournal(tx, {
        journalNumber: await this.repository.nextJournalNumber(tx, now.getUTCFullYear()),
        entryDate: payment.paymentDate,
        sourceType: 'CLAIM_PAYMENT',
        sourceId: id,
        claimId: payment.claimId,
        description: `Payment ${payment.paymentNumber} succeeded`,
        currencyCode: payment.settlementCurrencyCode,
        postedBy: context.userId,
        lines: {
          create: [
            {
              glAccountId: liability.id,
              claimId: payment.claimId,
              partyId: payment.payeePartyId,
              currencyCode: payment.settlementCurrencyCode,
              debitAmount: payment.settlementAmount,
              creditAmount: 0,
            },
            {
              glAccountId: asset.id,
              claimId: payment.claimId,
              partyId: payment.payeePartyId,
              currencyCode: payment.settlementCurrencyCode,
              debitAmount: 0,
              creditAmount: payment.settlementAmount,
            },
          ],
        },
      });
      const after = await position(this.repository, tx, payment.claimId);
      await recordStatus(
        tx,
        payment.claimId,
        before.status,
        after.status,
        context.userId,
        'Successful indemnity payment recorded',
      );
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'PAYMENT_SUCCEEDED',
        entityType: 'CLAIM_PAYMENT',
        entityId: id,
        correlationId: context.correlationId,
        oldValues: { status: payment.status },
        newValues: {
          status: 'SUCCESSFUL',
          settlementAmount: payment.settlementAmount.toString(),
          journalNumber: journal.journalNumber,
        },
      });
      return { ...serialize(updated), journals: [serializeJournal(journal)] };
    });
  }
  /** @param {string} id @param {{reason:string}} input @param {Context} context */
  reverse(id, input, context) {
    return this.transitionWithIdempotency(
      id,
      'PAYMENT_REVERSE',
      context,
      async (tx, payment) => {
        if (payment.status !== 'SUCCESSFUL') conflict('Only a successful payment can be reversed.');
        if ((payment.reconciliationMatches ?? []).length > 0)
          throw new AppError({
            code: 'PAYMENT_HAS_ACTIVE_RECONCILIATION',
            message: 'Unmatch all reconciliation evidence before reversing this payment.',
            status: 409,
          });
        await this.repository.lockPayable(tx, payment.payableId);
        const originalJournal = await this.repository.paymentJournal(tx, id);
        if (!originalJournal)
          throw new AppError({
            code: 'PAYMENT_JOURNAL_NOT_FOUND',
            message: 'The original payment journal is unavailable.',
            status: 503,
          });
        const accounts = await this.repository.paymentAccounts(tx);
        const liability = accounts.find((a) => a.code === 'CLAIMS_PAYABLE');
        const asset = accounts.find((a) => a.code === 'SETTLEMENT_ASSETS');
        if (!liability || !asset)
          throw new AppError({
            code: 'GL_CONFIGURATION_INVALID',
            message: 'Required general-ledger accounts are unavailable.',
            status: 503,
          });
        const before = await position(this.repository, tx, payment.claimId);
        const now = new Date();
        const updated = await this.repository.update(tx, id, {
          status: 'REVERSED',
          reversedBy: context.userId,
          reversedAt: now,
          reversalReason: input.reason,
        });
        const journal = await this.repository.createJournal(tx, {
          journalNumber: await this.repository.nextJournalNumber(tx, now.getUTCFullYear()),
          entryDate: now,
          sourceType: 'PAYMENT_REVERSAL',
          sourceId: id,
          claimId: payment.claimId,
          description: `Reversal of ${payment.paymentNumber}: ${input.reason}`,
          currencyCode: payment.settlementCurrencyCode,
          postedBy: context.userId,
          reversalOfEntryId: originalJournal.id,
          lines: {
            create: [
              {
                glAccountId: asset.id,
                claimId: payment.claimId,
                partyId: payment.payeePartyId,
                currencyCode: payment.settlementCurrencyCode,
                debitAmount: payment.settlementAmount,
                creditAmount: 0,
              },
              {
                glAccountId: liability.id,
                claimId: payment.claimId,
                partyId: payment.payeePartyId,
                currencyCode: payment.settlementCurrencyCode,
                debitAmount: 0,
                creditAmount: payment.settlementAmount,
              },
            ],
          },
        });
        const after = await position(this.repository, tx, payment.claimId);
        await recordStatus(
          tx,
          payment.claimId,
          before.status,
          after.status,
          context.userId,
          'Successful payment reversed',
        );
        await this.auditService.write(tx, {
          actorUserId: context.userId,
          action: 'PAYMENT_REVERSED',
          entityType: 'CLAIM_PAYMENT',
          entityId: id,
          correlationId: context.correlationId,
          oldValues: { status: 'SUCCESSFUL' },
          newValues: {
            status: 'REVERSED',
            reason: input.reason,
            journalNumber: journal.journalNumber,
          },
        });
        return { ...serialize(updated), journals: [serializeJournal(journal)] };
      },
      input,
    );
  }
  /** @param {string} id @param {string} scope @param {Context} context @param {(tx:import('@prisma/client').Prisma.TransactionClient,payment:any)=>Promise<any>} action @param {unknown} [input] */
  transitionWithIdempotency(id, scope, context, action, input) {
    return this.repository.transaction(async (tx) => {
      const request = { id, input };
      const replay = await resolveIdempotency(this.repository, tx, scope, context, request);
      if (replay) return replay;
      const payment = await this.repository.lockPayment(tx, id);
      if (!payment)
        throw new AppError({
          code: 'PAYMENT_NOT_FOUND',
          message: 'Payment not found.',
          status: 404,
        });
      const result = await action(tx, payment);
      await saveIdempotency(this.repository, tx, scope, context, request, result, 200);
      return result;
    });
  }
}

/** @typedef {{userId:string,correlationId:string,idempotencyKey:string}} Context */
/** @param {string} message @returns {never} */
function conflict(message) {
  throw new AppError({ code: 'PAYMENT_STATE_CONFLICT', message, status: 409 });
}
/** @param {string} value @param {number} places @param {string} label */ function validateScale(
  value,
  places,
  label,
) {
  if (new Prisma.Decimal(value).decimalPlaces() > places)
    throw new AppError({
      code: 'INVALID_CURRENCY_PRECISION',
      message: `${label} supports at most ${places} decimal places.`,
      status: 422,
    });
}
/** @param {import('./payments.repository.js').PaymentsRepository} repository @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} claimId */
async function position(repository, tx, claimId) {
  const raw = await repository.claimPosition(tx, claimId);
  return deriveFinancialPosition(
    raw.approved ?? new Prisma.Decimal(0),
    raw.paid ?? new Prisma.Decimal(0),
  );
}
/** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} claimId @param {import('@prisma/client').ClaimFinancialStatus} fromStatus @param {import('@prisma/client').ClaimFinancialStatus} toStatus @param {string} userId @param {string} reason */
async function recordStatus(tx, claimId, fromStatus, toStatus, userId, reason) {
  if (fromStatus !== toStatus)
    await tx.claimStatusHistory.create({
      data: { claimId, fromStatus, toStatus, changedBy: userId, reason },
    });
}
/** @param {unknown} value */
function hash(value) {
  return createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item) => (item instanceof Date ? item.toISOString() : item)),
    )
    .digest('hex');
}
/** @param {import('./payments.repository.js').PaymentsRepository} repository @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} scope @param {Context} context @param {unknown} request */
async function resolveIdempotency(repository, tx, scope, context, request) {
  const existing = await repository.idempotency(tx, scope, context.idempotencyKey, context.userId);
  if (!existing) return null;
  if (existing.requestHash !== hash(request))
    throw new AppError({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'The idempotency key was already used for a different request.',
      status: 409,
    });
  return existing.responseBody;
}
/** @param {import('./payments.repository.js').PaymentsRepository} repository @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} scope @param {Context} context @param {unknown} request @param {unknown} result @param {number} responseCode */
async function saveIdempotency(repository, tx, scope, context, request, result, responseCode) {
  const responseBody = /** @type {import('@prisma/client').Prisma.InputJsonValue} */ (
    JSON.parse(JSON.stringify(result))
  );
  await repository.saveIdempotency(tx, {
    scope,
    key: context.idempotencyKey,
    actorId: context.userId,
    requestHash: hash(request),
    responseCode,
    responseBody,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}
/** @param {PaymentShape} p */
function publicPayment(p) {
  return {
    paymentNumber: p.paymentNumber,
    payableId: p.payableId,
    paymentAmount: p.paymentAmount.toString(),
    paymentCurrencyCode: p.paymentCurrencyCode,
    fxRate: p.fxRate.toString(),
    settlementAmount: p.settlementAmount.toString(),
    settlementCurrencyCode: p.settlementCurrencyCode,
    status: p.status,
  };
}
/** @param {PaymentShape & {journals?:Array<JournalShape>}} p */
function serialize(p) {
  const reconciliationMatched = (p.reconciliationMatches ?? []).reduce(
    (total, match) => total.plus(match.matchedAmount),
    new Prisma.Decimal(0),
  );
  return {
    ...p,
    paymentAmount: p.paymentAmount.toString(),
    fxRate: p.fxRate.toString(),
    settlementAmount: p.settlementAmount.toString(),
    reconciliationMatchedAmount: reconciliationMatched.toString(),
    reconciliationUnmatchedAmount: p.paymentAmount.minus(reconciliationMatched).toString(),
    reconciliationStatus: reconciliationMatched.eq(0)
      ? 'UNMATCHED'
      : reconciliationMatched.gte(p.paymentAmount)
        ? 'MATCHED'
        : 'PARTIALLY_MATCHED',
    reconciliationMatches: undefined,
    journals: p.journals?.map(serializeJournal),
  };
}
/** @param {JournalShape} j */
function serializeJournal(j) {
  return {
    ...j,
    lines: j.lines?.map((l) => ({
      ...l,
      debitAmount: l.debitAmount.toString(),
      creditAmount: l.creditAmount.toString(),
    })),
  };
}

/** @typedef {{paymentNumber:string,payableId:string,paymentAmount:import('@prisma/client').Prisma.Decimal,paymentCurrencyCode:string,fxRate:import('@prisma/client').Prisma.Decimal,settlementAmount:import('@prisma/client').Prisma.Decimal,settlementCurrencyCode:string,status:string,reconciliationMatches?:Array<{matchedAmount:import('@prisma/client').Prisma.Decimal}>} & Record<string,unknown>} PaymentShape */
/** @typedef {{lines?:Array<{debitAmount:import('@prisma/client').Prisma.Decimal,creditAmount:import('@prisma/client').Prisma.Decimal} & Record<string,unknown>>} & Record<string,unknown>} JournalShape */
