export class PayablesRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */
  constructor(prisma) {
    this.prisma = prisma;
  }
  /** @template T @param {(tx: import('@prisma/client').Prisma.TransactionClient)=>Promise<T>} fn */
  transaction(fn) {
    return this.prisma.$transaction(fn);
  }
  /** @param {string} claimId */
  async list(claimId) {
    const [payables, journals] = await this.prisma.$transaction([
      this.prisma.claimPayable.findMany({
        where: { claimId },
        include: payableInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.journalEntry.findMany({
        where: { claimId, sourceType: 'CLAIM_PAYABLE' },
        include: { lines: { include: { glAccount: true } } },
      }),
    ]);
    return payables.map((payable) => ({
      ...payable,
      journal: journals.find((journal) => journal.sourceId === payable.id),
    }));
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  async lock(tx, id) {
    await tx.$queryRaw`SELECT id FROM claim_payables WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.claimPayable.findUnique({ where: { id }, include: payableInclude });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  claim(tx, id) {
    return tx.claim.findUnique({ where: { id }, include: { currency: true } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id */
  party(tx, id) {
    return tx.party.findFirst({ where: { id, status: 'ACTIVE' } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.ClaimPayableUncheckedCreateInput} data */
  create(tx, data) {
    return tx.claimPayable.create({ data, include: payableInclude });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id @param {import('@prisma/client').Prisma.ClaimPayableUncheckedUpdateInput} data */
  update(tx, id, data) {
    return tx.claimPayable.update({ where: { id }, data, include: payableInclude });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {number} year */
  async nextJournalNumber(tx, year) {
    /** @type {Array<{value:number}>} */
    const rows =
      await tx.$queryRaw`INSERT INTO journal_number_sequences (year, next_value) VALUES (${year}, 2) ON CONFLICT (year) DO UPDATE SET next_value = journal_number_sequences.next_value + 1 RETURNING next_value - 1 AS value`;
    return `JRN-${year}-${String(rows[0].value).padStart(6, '0')}`;
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx */
  accounts(tx) {
    return tx.gLAccount.findMany({
      where: { code: { in: ['CLAIMS_EXPENSE', 'CLAIMS_PAYABLE'] }, isActive: true },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} claimId */
  approvedIndemnityCount(tx, claimId) {
    return tx.claimPayable.count({
      where: { claimId, payableType: 'INDEMNITY', status: 'APPROVED' },
    });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.JournalEntryUncheckedCreateInput & {lines: {create: import('@prisma/client').Prisma.JournalLineUncheckedCreateWithoutJournalEntryInput[]}}} data */
  createJournal(tx, data) {
    return tx.journalEntry.create({
      data: { ...data, lines: { create: data.lines.create } },
      include: { lines: { include: { glAccount: true } } },
    });
  }
}

const payableInclude = {
  claim: { select: { id: true, claimNumber: true, currencyCode: true } },
  payee: true,
  creator: { select: { id: true, firstName: true, lastName: true } },
  approver: { select: { id: true, firstName: true, lastName: true } },
};
