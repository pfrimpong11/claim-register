export class PaymentsRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */ constructor(prisma) {
    this.prisma = prisma;
  }
  /** @template T @param {(tx:import('@prisma/client').Prisma.TransactionClient)=>Promise<T>} fn */
  transaction(fn) {
    return this.prisma.$transaction(fn, { isolationLevel: 'Serializable' });
  }
  /** @param {string} payableId */
  async list(payableId) {
    const payments = await this.prisma.claimPayment.findMany({
      where: { payableId },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
    const ids = payments.map((p) => p.id);
    const journals = await this.prisma.journalEntry.findMany({
      where: { sourceId: { in: ids }, sourceType: { in: ['CLAIM_PAYMENT', 'PAYMENT_REVERSAL'] } },
      include: { lines: { include: { glAccount: true } } },
    });
    return payments.map((p) => ({ ...p, journals: journals.filter((j) => j.sourceId === p.id) }));
  }
  settlementAccounts() {
    return this.prisma.settlementAccount.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  async lockPayable(tx, id) {
    await tx.$queryRaw`SELECT id FROM claim_payables WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.claimPayable.findUnique({
      where: { id },
      include: { claim: { include: { currency: true } }, payee: true },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  async lockPayment(tx, id) {
    await tx.$queryRaw`SELECT id FROM claim_payments WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.claimPayment.findUnique({ where: { id }, include: paymentInclude });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  account(tx, id) {
    return tx.settlementAccount.findFirst({ where: { id, status: 'ACTIVE' } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} code */
  currency(tx, code) {
    return tx.currency.findFirst({ where: { code, isActive: true } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {number} year */
  async nextPaymentNumber(tx, year) {
    const rows = /** @type {Array<{value:number}>} */ (
      await tx.$queryRaw`INSERT INTO payment_number_sequences (year, next_value) VALUES (${year}, 2) ON CONFLICT (year) DO UPDATE SET next_value = payment_number_sequences.next_value + 1 RETURNING next_value - 1 AS value`
    );
    return `PAY-${year}-${String(rows[0].value).padStart(6, '0')}`;
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {number} year */
  async nextJournalNumber(tx, year) {
    const rows = /** @type {Array<{value:number}>} */ (
      await tx.$queryRaw`INSERT INTO journal_number_sequences (year, next_value) VALUES (${year}, 2) ON CONFLICT (year) DO UPDATE SET next_value = journal_number_sequences.next_value + 1 RETURNING next_value - 1 AS value`
    );
    return `JRN-${year}-${String(rows[0].value).padStart(6, '0')}`;
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} scope @param {string} key @param {string} actorId */
  idempotency(tx, scope, key, actorId) {
    return tx.idempotencyKey.findUnique({ where: { scope_key_actorId: { scope, key, actorId } } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.IdempotencyKeyUncheckedCreateInput} data */
  saveIdempotency(tx, data) {
    return tx.idempotencyKey.create({ data });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.ClaimPaymentUncheckedCreateInput} data */
  create(tx, data) {
    return tx.claimPayment.create({ data, include: paymentInclude });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id @param {import('@prisma/client').Prisma.ClaimPaymentUncheckedUpdateInput} data */
  update(tx, id, data) {
    return tx.claimPayment.update({ where: { id }, data, include: paymentInclude });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} payableId */
  paidForPayable(tx, payableId) {
    return tx.claimPayment.aggregate({
      where: { payableId, status: 'SUCCESSFUL' },
      _sum: { settlementAmount: true },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} claimId */
  async claimPosition(tx, claimId) {
    const [approved, paid] = await Promise.all([
      tx.claimPayable.aggregate({
        where: { claimId, payableType: 'INDEMNITY', status: 'APPROVED' },
        _sum: { amount: true },
      }),
      tx.claimPayment.aggregate({
        where: { claimId, payable: { payableType: 'INDEMNITY' }, status: 'SUCCESSFUL' },
        _sum: { settlementAmount: true },
      }),
    ]);
    return { approved: approved._sum.amount, paid: paid._sum.settlementAmount };
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx */
  paymentAccounts(tx) {
    return tx.gLAccount.findMany({
      where: { code: { in: ['CLAIMS_PAYABLE', 'SETTLEMENT_ASSETS'] }, isActive: true },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.JournalEntryUncheckedCreateInput & {lines:{create:import('@prisma/client').Prisma.JournalLineUncheckedCreateWithoutJournalEntryInput[]}}} data */
  createJournal(tx, data) {
    return tx.journalEntry.create({ data, include: { lines: { include: { glAccount: true } } } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} paymentId */
  paymentJournal(tx, paymentId) {
    return tx.journalEntry.findUnique({
      where: { sourceType_sourceId: { sourceType: 'CLAIM_PAYMENT', sourceId: paymentId } },
    });
  }
}
const paymentInclude = {
  settlementAccount: true,
  payee: true,
  payable: { include: { claim: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
  approver: { select: { id: true, firstName: true, lastName: true } },
};
