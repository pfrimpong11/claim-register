export class AccountingRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */ constructor(prisma) {
    this.prisma = prisma;
  }
  list() {
    return this.prisma.journalEntry.findMany({
      include: {
        claim: { select: { id: true, claimNumber: true } },
        lines: { include: { glAccount: true } },
      },
      orderBy: { postedAt: 'desc' },
      take: 100,
    });
  }
  /** @param {string} id */ get(id) {
    return this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        claim: { select: { id: true, claimNumber: true } },
        lines: { include: { glAccount: true } },
        reversalOf: { select: { id: true, journalNumber: true } },
        reversals: { select: { id: true, journalNumber: true } },
      },
    });
  }
}
