export class ReportsRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */ constructor(prisma) {
    this.prisma = prisma;
  }
  /** @param {import('@prisma/client').Prisma.ReportExportUncheckedCreateInput} data */ create(
    data,
  ) {
    return this.prisma.reportExport.create({ data });
  }
  /** @param {string} id */ get(id) {
    return this.prisma.reportExport.findUnique({ where: { id } });
  }
  /** @param {string} id @param {string} requestedBy */ getForRequester(id, requestedBy) {
    return this.prisma.reportExport.findFirst({ where: { id, requestedBy } });
  }
  /** @param {string} id @param {import('@prisma/client').Prisma.ReportExportUncheckedUpdateInput} data */ update(
    id,
    data,
  ) {
    return this.prisma.reportExport.update({ where: { id }, data });
  }
  pending() {
    return this.prisma.reportExport.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      select: { id: true },
    });
  }
}
