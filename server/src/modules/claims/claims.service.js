import { AppError } from '../../shared/errors.js';
export class ClaimsService {
  /** @param {import('./claims.repository.js').ClaimsRepository} repository @param {import('../audit/audit.service.js').AuditService} auditService */
  constructor(repository, auditService) {
    this.repository = repository;
    this.auditService = auditService;
  }
  /** @param {import('zod').infer<typeof import('./claims.schemas.js').claimBodySchema>} input @param {{userId:string,correlationId:string}} context */
  async create(input, context) {
    return this.repository.transaction(async (tx) => {
      const policy = await this.repository.findPolicy(tx, input.policyId);
      if (!policy)
        throw new AppError({
          code: 'POLICY_NOT_FOUND',
          message: 'The selected policy is unavailable.',
          status: 404,
        });
      const claimNumber = await this.repository.nextClaimNumber(
        tx,
        input.notificationDate.getUTCFullYear(),
      );
      const claim = await this.repository.createClaim(tx, {
        claimNumber,
        policyId: policy.id,
        policyNumberSnapshot: policy.policyNumber,
        policyNameSnapshot: policy.policyName,
        insuredNameSnapshot: policy.insuredParty.displayName,
        lossDate: input.lossDate,
        notificationDate: input.notificationDate,
        notificationOverrideReason: input.notificationOverrideReason,
        lossNature: input.lossNature,
        description: input.description,
        currencyCode: policy.currencyCode,
        createdBy: context.userId,
      });
      const reserve = await this.repository.createReserve(tx, {
        claimId: claim.id,
        amount: input.estimatedLossAmount,
        currencyCode: policy.currencyCode,
        createdBy: context.userId,
        reason: 'Initial estimated loss',
      });
      await this.repository.createStatus(tx, {
        claimId: claim.id,
        toStatus: 'RESERVED_NOT_SETTLED',
        reason: 'Initial reserve created',
        changedBy: context.userId,
      });
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'CLAIM_CREATED',
        entityType: 'CLAIM',
        entityId: claim.id,
        correlationId: context.correlationId,
        newValues: {
          claimNumber,
          policyNumber: policy.policyNumber,
          estimatedLossAmount: input.estimatedLossAmount,
          currencyCode: policy.currencyCode,
        },
      });
      return {
        ...claim,
        estimatedLossAmount: reserve.amount.toString(),
        financialStatus: 'RESERVED_NOT_SETTLED',
      };
    });
  }
  /** @param {string} id */
  async get(id) {
    const claim = await this.repository.get(id);
    if (!claim)
      throw new AppError({ code: 'CLAIM_NOT_FOUND', message: 'Claim not found.', status: 404 });
    return serialize(claim);
  }
  /** @param {import('zod').infer<typeof import('./claims.schemas.js').claimsQuerySchema>} query */
  async list(query) {
    /** @type {import('@prisma/client').Prisma.ClaimWhereInput} */
    const where = {
      ...(query.currency && { currencyCode: query.currency.toUpperCase() }),
      ...(query.policy && {
        policyNumberSnapshot: { contains: query.policy, mode: 'insensitive' },
      }),
      ...(query.insured && {
        insuredNameSnapshot: { contains: query.insured, mode: 'insensitive' },
      }),
      ...(query.status &&
        query.status !== 'RESERVED_NOT_SETTLED' && {
          id: { equals: '00000000-0000-0000-0000-000000000000' },
        }),
      ...(query.lossNature && { lossNature: { contains: query.lossNature, mode: 'insensitive' } }),
      ...(query.search && {
        OR: [
          { claimNumber: { contains: query.search, mode: 'insensitive' } },
          { policyNumberSnapshot: { contains: query.search, mode: 'insensitive' } },
          { insuredNameSnapshot: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...((query.lossFrom || query.lossTo) && {
        lossDate: {
          ...(query.lossFrom && { gte: query.lossFrom }),
          ...(query.lossTo && { lte: query.lossTo }),
        },
      }),
      ...((query.notificationFrom || query.notificationTo) && {
        notificationDate: {
          ...(query.notificationFrom && { gte: query.notificationFrom }),
          ...(query.notificationTo && { lte: query.notificationTo }),
        },
      }),
    };
    const result = await this.repository.list(where, query);
    return {
      data: result.items.map(serialize),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
      summaries: result.grouped.map((g) => ({
        currencyCode: g.currencyCode,
        claimCount: g._count,
        estimatedLoss: g._sum?.amount?.toString() ?? '0',
        approvedAmount: '0',
        paidAmount: '0',
        outstandingAmount: '0',
      })),
    };
  }
}
/**
 * @param {{
 *   reserves?: Array<{
 *     status: string,
 *     amount: import('@prisma/client').Prisma.Decimal
 *   }>
 * } & Record<string, unknown>} claim
 */
function serialize(claim) {
  const reserve = claim.reserves?.find((r) => r.status === 'ACTIVE');
  return {
    ...claim,
    estimatedLossAmount: reserve?.amount?.toString() ?? '0',
    approvedAmount: '0',
    paidAmount: '0',
    outstandingAmount: '0',
    financialStatus: 'RESERVED_NOT_SETTLED',
  };
}
