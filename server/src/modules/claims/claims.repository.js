export class ClaimsRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */ constructor(prisma) {
    this.prisma = prisma;
  }
  /** @template T @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} operation @returns {Promise<T>} */
  transaction(operation) {
    return this.prisma.$transaction(operation);
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  findPolicy(tx, id) {
    return tx.policy.findFirst({
      where: { id, status: 'ACTIVE' },
      include: { insuredParty: true },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {number} year */
  async nextClaimNumber(tx, year) {
    /** @type {Array<{value:number}>} */
    const rows =
      await tx.$queryRaw`INSERT INTO claim_number_sequences (year, next_value) VALUES (${year}, 2) ON CONFLICT (year) DO UPDATE SET next_value = claim_number_sequences.next_value + 1 RETURNING next_value - 1 AS value`;
    return `CLM-${year}-${String(rows[0].value).padStart(6, '0')}`;
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.ClaimUncheckedCreateInput} data */
  createClaim(tx, data) {
    return tx.claim.create({ data });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.ClaimReserveUncheckedCreateInput} data */
  createReserve(tx, data) {
    return tx.claimReserve.create({ data });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.ClaimStatusHistoryUncheckedCreateInput} data */
  createStatus(tx, data) {
    return tx.claimStatusHistory.create({ data });
  }
  /** @param {string} id */
  get(id) {
    return this.prisma.claim.findUnique({
      where: { id },
      include: {
        policy: { include: { insuredParty: true } },
        reserves: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        payables: { where: { status: 'APPROVED', payableType: 'INDEMNITY' } },
      },
    });
  }
  /** @param {import('@prisma/client').Prisma.ClaimWhereInput} where @param {import('zod').infer<typeof import('./claims.schemas.js').claimsQuerySchema>} query */
  async list(where, query) {
    const [items, total, grouped, approvedGrouped] = await this.prisma.$transaction([
      this.prisma.claim.findMany({
        where,
        include: {
          reserves: { where: { status: 'ACTIVE', reserveType: 'INDEMNITY' }, take: 1 },
          payables: { where: { status: 'APPROVED', payableType: 'INDEMNITY' } },
        },
        orderBy: { [query.sort]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.claim.count({ where }),
      this.prisma.claimReserve.groupBy({
        by: ['currencyCode'],
        orderBy: { currencyCode: 'asc' },
        where: { status: 'ACTIVE', reserveType: 'INDEMNITY', claim: where },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.claimPayable.groupBy({
        by: ['currencyCode'],
        orderBy: { currencyCode: 'asc' },
        where: { status: 'APPROVED', payableType: 'INDEMNITY', claim: where },
        _sum: { amount: true },
      }),
    ]);
    return { items, total, grouped, approvedGrouped };
  }
}
