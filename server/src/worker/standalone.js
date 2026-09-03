import { env } from '../config/env.js';
import { createPrismaClient } from '../infrastructure/prisma.js';
import { createRedisConnection, ensureRedisConnected } from '../infrastructure/redis.js';
import { logger } from '../shared/logger.js';
import { createDocumentStorage } from '../storage/document-storage.js';
import { DocumentCleanupService } from '../modules/documents/document-cleanup.service.js';
import { DocumentsRepository } from '../modules/documents/documents.repository.js';
import { CsvImportService } from '../modules/reconciliation/csv-import.service.js';
import { ReconciliationRepository } from '../modules/reconciliation/reconciliation.repository.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { ClaimsRepository } from '../modules/claims/claims.repository.js';
import { ClaimsService } from '../modules/claims/claims.service.js';
import { ClaimsExportService } from '../modules/reports/claims-export.service.js';
import { ReportsRepository } from '../modules/reports/reports.repository.js';
import { fileURLToPath } from 'node:url';
import { WorkerRuntime } from './runtime.js';

const redis = createRedisConnection(env.REDIS_URL);
const prisma = createPrismaClient(logger);
const documentCleanup = new DocumentCleanupService({
  repository: new DocumentsRepository(prisma),
  storage: createDocumentStorage(env),
  logger,
});
const csvImport = new CsvImportService({
  repository: new ReconciliationRepository(prisma),
  logger,
});
const claimsExport = new ClaimsExportService({
  repository: new ReportsRepository(prisma),
  claimsService: new ClaimsService(new ClaimsRepository(prisma), new AuditService(prisma)),
  exportsDirectory: fileURLToPath(new URL('../../uploads/exports/', import.meta.url)),
  logger,
});
const workerRuntime = new WorkerRuntime({
  connection: redis,
  logger,
  concurrency: env.WORKER_CONCURRENCY,
  services: { documentCleanup, csvImport, claimsExport },
});
let shuttingDown = false;

try {
  await ensureRedisConnected(redis);
  await prisma.$connect();
  await workerRuntime.start();
  logger.info('standalone worker ready');

  /** @param {string} signal */
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'standalone worker shutdown started');
    try {
      await workerRuntime.close();
      await prisma.$disconnect();
      if (redis.status !== 'end') await redis.quit();
      logger.info('standalone worker shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.fatal({ err: error }, 'standalone worker shutdown failed');
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
} catch (error) {
  logger.fatal({ err: error }, 'standalone worker startup failed');
  if (redis.status !== 'end') redis.disconnect();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
}
