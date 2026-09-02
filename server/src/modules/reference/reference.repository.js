export class ReferenceRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */ constructor(prisma) {
    this.prisma = prisma;
  }
  listCurrencies() {
    return this.prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  }
  /** @param {string} q @param {number} take */
  searchParties(q, take) {
    return this.prisma.party.findMany({
      where: { status: 'ACTIVE', displayName: { contains: q, mode: 'insensitive' } },
      orderBy: { displayName: 'asc' },
      take,
    });
  }
  /** @param {import('@prisma/client').Prisma.PartyUncheckedCreateInput} data */
  createParty(data) {
    return this.prisma.party.create({ data });
  }
  /** @param {string} q @param {number} take */
  searchPolicies(q, take) {
    return this.prisma.policy.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { policyNumber: { contains: q, mode: 'insensitive' } },
          { policyName: { contains: q, mode: 'insensitive' } },
          { insuredParty: { displayName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { insuredParty: true },
      orderBy: { policyNumber: 'asc' },
      take,
    });
  }
  /** @param {import('@prisma/client').Prisma.PolicyUncheckedCreateInput} data */
  createPolicy(data) {
    return this.prisma.policy.create({ data, include: { insuredParty: true } });
  }
}
