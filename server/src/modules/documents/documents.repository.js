export class DocumentsRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */
  constructor(prisma) {
    this.prisma = prisma;
  }
  /** @template T @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} operation */
  transaction(operation) {
    return this.prisma.$transaction(operation);
  }
  /** @param {string} claimId */
  claimExists(claimId) {
    return this.prisma.claim.count({ where: { id: claimId } }).then(Boolean);
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {import('@prisma/client').Prisma.ClaimDocumentUncheckedCreateInput} data */
  create(tx, data) {
    return tx.claimDocument.create({ data });
  }
  /** @param {string} claimId */
  list(claimId) {
    return this.prisma.claimDocument.findMany({
      where: { claimId, status: 'ACTIVE' },
      orderBy: { uploadedAt: 'desc' },
      include: { uploader: { select: { firstName: true, lastName: true } } },
    });
  }
  /** @param {string} id */
  getActive(id) {
    return this.prisma.claimDocument.findFirst({ where: { id, status: 'ACTIVE' } });
  }
  /** @param {import('@prisma/client').Prisma.TransactionClient} tx @param {string} id @param {string} userId */
  deactivate(tx, id, userId) {
    return tx.claimDocument.updateMany({
      where: { id, status: 'ACTIVE' },
      data: {
        status: 'INACTIVE',
        deactivatedBy: userId,
        deactivatedAt: new Date(),
        cleanupStatus: 'PENDING',
      },
    });
  }
  /** @param {string} id */
  getPendingCleanup(id) {
    return this.prisma.claimDocument.findFirst({ where: { id, cleanupStatus: 'PENDING' } });
  }
  listPendingCleanup() {
    return this.prisma.claimDocument.findMany({
      where: { cleanupStatus: 'PENDING' },
      select: { id: true },
      orderBy: { deactivatedAt: 'asc' },
      take: 500,
    });
  }
  /** @param {string} id */
  markCleanupCompleted(id) {
    return this.prisma.claimDocument.updateMany({
      where: { id, cleanupStatus: 'PENDING' },
      data: { cleanupStatus: 'COMPLETED', cleanupCompletedAt: new Date(), cleanupLastError: null },
    });
  }
  /** @param {string} id @param {unknown} error */
  markCleanupFailed(id, error) {
    const message = error instanceof Error ? error.message : 'Unknown cleanup failure';
    return this.prisma.claimDocument.updateMany({
      where: { id, cleanupStatus: 'PENDING' },
      data: { cleanupAttempts: { increment: 1 }, cleanupLastError: message.slice(0, 1000) },
    });
  }
}
