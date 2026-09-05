export class AuditRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */ constructor(prisma) {
    this.prisma = prisma;
  }
  /** @param {import('zod').infer<typeof import('./audit.schemas.js').auditQuerySchema>} query */
  async list(query) {
    /** @type {import('@prisma/client').Prisma.AuditLogWhereInput} */
    const where = {
      ...(query.action && { action: { contains: query.action, mode: 'insensitive' } }),
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.claimId && { claimId: query.claimId }),
      ...(query.actorUserId && { actorUserId: query.actorUserId }),
      ...((query.from || query.to) && {
        occurredAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total };
  }
}
