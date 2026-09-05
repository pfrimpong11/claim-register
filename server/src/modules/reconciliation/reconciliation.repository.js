import { Prisma } from '@prisma/client';

export class ReconciliationRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */ constructor(prisma) {
    this.prisma = prisma;
  }
  /** @template T @param {(tx:import('@prisma/client').Prisma.TransactionClient)=>Promise<T>} fn */
  transaction(fn) {
    return this.prisma.$transaction(fn, { isolationLevel: 'Serializable' });
  }
  /** @param {string} id */ account(id) {
    return this.prisma.settlementAccount.findFirst({ where: { id, status: 'ACTIVE' } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionImportUncheckedCreateInput} data */ createImport(
    data,
  ) {
    return this.prisma.transactionImport.create({ data, include: { settlementAccount: true } });
  }
  /** @param {string} id */ importById(id) {
    return this.prisma.transactionImport.findUnique({
      where: { id },
      include: { settlementAccount: true },
    });
  }
  /** @param {string} id @param {import('@prisma/client').Prisma.TransactionImportUncheckedUpdateInput} data */ updateImport(
    id,
    data,
  ) {
    return this.prisma.transactionImport.update({ where: { id }, data });
  }
  pendingImports() {
    return this.prisma.transactionImport.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      select: { id: true },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {any} data */
  createExternal(tx, data) {
    return tx.externalTransaction.create({ data });
  }
  listImports() {
    return this.prisma.transactionImport.findMany({
      include: { settlementAccount: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  /** @param {import('zod').infer<typeof import('./reconciliation.schemas.js').transactionQuerySchema>} query */ async listTransactions(
    query,
  ) {
    const where = {
      ...(query.status ? { reconciliationStatus: query.status } : {}),
      ...(query.settlementAccountId ? { settlementAccountId: query.settlementAccountId } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.externalTransaction.findMany({
        where,
        include: {
          settlementAccount: true,
          matches: { where: { status: 'ACTIVE' }, include: { payment: true } },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.externalTransaction.count({ where }),
    ]);
    return { rows, total };
  }
  async listPayments() {
    return this.prisma.claimPayment.findMany({
      where: { status: 'SUCCESSFUL' },
      include: {
        settlementAccount: true,
        payable: { include: { claim: true } },
        reconciliationMatches: { where: { status: 'ACTIVE' } },
      },
      orderBy: { succeededAt: 'desc' },
      take: 100,
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  async lockPayment(tx, id) {
    await tx.$queryRaw`SELECT id FROM claim_payments WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.claimPayment.findUnique({
      where: { id },
      include: { reconciliationMatches: { where: { status: 'ACTIVE' } } },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  async lockExternal(tx, id) {
    await tx.$queryRaw`SELECT id FROM external_transactions WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.externalTransaction.findUnique({
      where: { id },
      include: { matches: { where: { status: 'ACTIVE' } } },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  async lockMatch(tx, id) {
    await tx.$queryRaw`SELECT id FROM reconciliation_matches WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.reconciliationMatch.findUnique({
      where: { id },
      include: { payment: { select: { claimId: true } } },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.ReconciliationMatchUncheckedCreateInput} data */ createMatch(
    tx,
    data,
  ) {
    return tx.reconciliationMatch.create({ data, include: matchInclude });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id @param {import('@prisma/client').Prisma.ReconciliationMatchUncheckedUpdateInput} data */ updateMatch(
    tx,
    id,
    data,
  ) {
    return tx.reconciliationMatch.update({ where: { id }, data, include: matchInclude });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id @param {import('@prisma/client').ReconciliationStatus} reconciliationStatus */ updateExternalStatus(
    tx,
    id,
    reconciliationStatus,
  ) {
    return tx.externalTransaction.update({ where: { id }, data: { reconciliationStatus } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */ activeExternalMatched(
    tx,
    id,
  ) {
    return tx.reconciliationMatch.aggregate({
      where: { externalTransactionId: id, status: 'ACTIVE' },
      _sum: { matchedAmount: true },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */ activePaymentMatched(
    tx,
    id,
  ) {
    return tx.reconciliationMatch.aggregate({
      where: { paymentId: id, status: 'ACTIVE' },
      _sum: { matchedAmount: true },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} scope @param {string} key @param {string} actorId */ idempotency(
    tx,
    scope,
    key,
    actorId,
  ) {
    return tx.idempotencyKey.findUnique({ where: { scope_key_actorId: { scope, key, actorId } } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.IdempotencyKeyUncheckedCreateInput} data */ saveIdempotency(
    tx,
    data,
  ) {
    return tx.idempotencyKey.create({ data });
  }
}
const matchInclude = {
  payment: { include: { payable: { include: { claim: true } } } },
  externalTransaction: { include: { settlementAccount: true } },
  matcher: { select: { id: true, firstName: true, lastName: true } },
};
export const zero = () => new Prisma.Decimal(0);
