import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors.js';

export class PayablesService {
  /** @param {import('./payables.repository.js').PayablesRepository} repository @param {import('../audit/audit.service.js').AuditService} auditService */
  constructor(repository, auditService) {
    this.repository = repository;
    this.auditService = auditService;
  }
  /** @param {string} claimId */
  async list(claimId) {
    return (await this.repository.list(claimId)).map((payable) => ({
      ...serialize(payable),
      journal: payable.journal ? serializeJournal(payable.journal) : undefined,
    }));
  }
  /** @param {string} claimId @param {{payeePartyId:string,amount:string,description?:string|null}} input @param {{userId:string,correlationId:string}} context */
  create(claimId, input, context) {
    return this.repository.transaction(async (tx) => {
      const [claim, payee] = await Promise.all([
        this.repository.claim(tx, claimId),
        this.repository.party(tx, input.payeePartyId),
      ]);
      if (!claim)
        throw new AppError({ code: 'CLAIM_NOT_FOUND', message: 'Claim not found.', status: 404 });
      if (!payee)
        throw new AppError({
          code: 'PAYEE_NOT_FOUND',
          message: 'The selected payee is unavailable.',
          status: 404,
        });
      validateScale(input.amount, claim.currency.decimalPlaces);
      const payable = await this.repository.create(tx, {
        claimId,
        payeePartyId: payee.id,
        payableType: 'INDEMNITY',
        amount: input.amount,
        currencyCode: claim.currencyCode,
        description: input.description,
        createdBy: context.userId,
      });
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'PAYABLE_CREATED',
        entityType: 'CLAIM_PAYABLE',
        entityId: payable.id,
        correlationId: context.correlationId,
        newValues: {
          claimId,
          payableType: 'INDEMNITY',
          amount: input.amount,
          currencyCode: claim.currencyCode,
          payeePartyId: payee.id,
        },
      });
      return serialize(payable);
    });
  }
  /** @param {string} id @param {{userId:string,correlationId:string}} context */
  approve(id, context) {
    return this.repository.transaction(async (tx) => {
      const payable = await this.repository.lock(tx, id);
      if (!payable)
        throw new AppError({
          code: 'PAYABLE_NOT_FOUND',
          message: 'Payable not found.',
          status: 404,
        });
      if (payable.status !== 'DRAFT')
        throw new AppError({
          code: 'PAYABLE_NOT_DRAFT',
          message: 'Only a draft payable can be approved.',
          status: 409,
        });
      const accounts = await this.repository.accounts(tx);
      const expense = accounts.find((a) => a.code === 'CLAIMS_EXPENSE');
      const liability = accounts.find((a) => a.code === 'CLAIMS_PAYABLE');
      if (!expense || !liability)
        throw new AppError({
          code: 'GL_CONFIGURATION_INVALID',
          message: 'Required general-ledger accounts are unavailable.',
          status: 503,
        });
      const priorApprovedCount = await this.repository.approvedIndemnityCount(tx, payable.claimId);
      const now = new Date();
      const approved = await this.repository.update(tx, id, {
        status: 'APPROVED',
        approvedBy: context.userId,
        approvedAt: now,
      });
      const journalNumber = await this.repository.nextJournalNumber(tx, now.getUTCFullYear());
      const journal = await this.repository.createJournal(tx, {
        journalNumber,
        entryDate: now,
        sourceType: 'CLAIM_PAYABLE',
        sourceId: id,
        claimId: payable.claimId,
        description: `Indemnity payable approved for ${payable.claim.claimNumber}`,
        currencyCode: payable.currencyCode,
        postedBy: context.userId,
        lines: {
          create: [
            {
              glAccountId: expense.id,
              claimId: payable.claimId,
              partyId: payable.payeePartyId,
              currencyCode: payable.currencyCode,
              debitAmount: payable.amount,
              creditAmount: 0,
            },
            {
              glAccountId: liability.id,
              claimId: payable.claimId,
              partyId: payable.payeePartyId,
              currencyCode: payable.currencyCode,
              debitAmount: 0,
              creditAmount: payable.amount,
            },
          ],
        },
      });
      if (priorApprovedCount === 0) {
        await tx.claimStatusHistory.create({
          data: {
            claimId: payable.claimId,
            fromStatus: 'RESERVED_NOT_SETTLED',
            toStatus: 'SETTLED_PAYMENT_OUTSTANDING',
            reason: 'First indemnity payable approved',
            changedBy: context.userId,
          },
        });
      }
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'PAYABLE_APPROVED',
        entityType: 'CLAIM_PAYABLE',
        entityId: id,
        correlationId: context.correlationId,
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'APPROVED', journalNumber },
      });
      return { ...serialize(approved), journal: serializeJournal(journal) };
    });
  }
  /** @param {string} id @param {{reason:string}} input @param {{userId:string,correlationId:string}} context */
  cancel(id, input, context) {
    return this.repository.transaction(async (tx) => {
      const payable = await this.repository.lock(tx, id);
      if (!payable)
        throw new AppError({
          code: 'PAYABLE_NOT_FOUND',
          message: 'Payable not found.',
          status: 404,
        });
      if (payable.status !== 'DRAFT')
        throw new AppError({
          code: 'PAYABLE_NOT_DRAFT',
          message: 'Only a draft payable can be cancelled.',
          status: 409,
        });
      const cancelled = await this.repository.update(tx, id, {
        status: 'CANCELLED',
        cancelledBy: context.userId,
        cancelledAt: new Date(),
        cancellationReason: input.reason,
      });
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'PAYABLE_CANCELLED',
        entityType: 'CLAIM_PAYABLE',
        entityId: id,
        correlationId: context.correlationId,
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'CANCELLED', reason: input.reason },
      });
      return serialize(cancelled);
    });
  }
}

/** @param {string} value @param {number} places */
function validateScale(value, places) {
  if (new Prisma.Decimal(value).decimalPlaces() > places)
    throw new AppError({
      code: 'INVALID_CURRENCY_PRECISION',
      message: `Amount supports at most ${places} decimal places.`,
      status: 422,
    });
}
/** @param {{amount: import('@prisma/client').Prisma.Decimal} & Record<string, unknown>} p */
function serialize(p) {
  return { ...p, amount: p.amount.toString() };
}
/** @param {{lines:Array<{debitAmount:import('@prisma/client').Prisma.Decimal,creditAmount:import('@prisma/client').Prisma.Decimal} & Record<string, unknown>>} & Record<string, unknown>} j */
function serializeJournal(j) {
  return {
    ...j,
    lines: j.lines.map((l) => ({
      ...l,
      debitAmount: l.debitAmount.toString(),
      creditAmount: l.creditAmount.toString(),
    })),
  };
}
