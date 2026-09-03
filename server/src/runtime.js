import { createApp } from './app.js';
import { Queue } from 'bullmq';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { createPrismaClient } from './infrastructure/prisma.js';
import { createRedisConnection, ensureRedisConnected } from './infrastructure/redis.js';
import { createAuthenticate } from './middleware/authenticate.js';
import { createCsrfProtection } from './middleware/csrf.js';
import { AuditService } from './modules/audit/audit.service.js';
import { AuditController } from './modules/audit/audit.controller.js';
import { AuditRepository } from './modules/audit/audit.repository.js';
import { createAuditRouter } from './modules/audit/audit.routes.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { ClaimsController } from './modules/claims/claims.controller.js';
import { ClaimsRepository } from './modules/claims/claims.repository.js';
import { createClaimsRouter } from './modules/claims/claims.routes.js';
import { ClaimsService } from './modules/claims/claims.service.js';
import { HealthService } from './modules/health/health.service.js';
import { DocumentsController } from './modules/documents/documents.controller.js';
import { DocumentCleanupService } from './modules/documents/document-cleanup.service.js';
import { DocumentsRepository } from './modules/documents/documents.repository.js';
import { createDocumentsRouter } from './modules/documents/documents.routes.js';
import { DocumentsService } from './modules/documents/documents.service.js';
import { ReferenceController } from './modules/reference/reference.controller.js';
import { ReferenceRepository } from './modules/reference/reference.repository.js';
import { createReferenceRouter } from './modules/reference/reference.routes.js';
import { ReferenceService } from './modules/reference/reference.service.js';
import { PayablesController } from './modules/payables/payables.controller.js';
import { PayablesRepository } from './modules/payables/payables.repository.js';
import { createPayablesRouter } from './modules/payables/payables.routes.js';
import { PayablesService } from './modules/payables/payables.service.js';
import { PaymentsController } from './modules/payments/payments.controller.js';
import { PaymentsRepository } from './modules/payments/payments.repository.js';
import { createPaymentsRouter } from './modules/payments/payments.routes.js';
import { PaymentsService } from './modules/payments/payments.service.js';
import { AccountingController } from './modules/accounting/accounting.controller.js';
import { AccountingRepository } from './modules/accounting/accounting.repository.js';
import { createAccountingRouter } from './modules/accounting/accounting.routes.js';
import { CsvImportService } from './modules/reconciliation/csv-import.service.js';
import { ReconciliationController } from './modules/reconciliation/reconciliation.controller.js';
import { ReconciliationRepository } from './modules/reconciliation/reconciliation.repository.js';
import { createReconciliationRouter } from './modules/reconciliation/reconciliation.routes.js';
import { ReconciliationService } from './modules/reconciliation/reconciliation.service.js';
import { ClaimsExportService } from './modules/reports/claims-export.service.js';
import { ReportsController } from './modules/reports/reports.controller.js';
import { ReportsRepository } from './modules/reports/reports.repository.js';
import { createReportsRouter } from './modules/reports/reports.routes.js';
import { createGlobalRateLimiter, createLoginRateLimiter } from './security/rate-limit.js';
import { logger } from './shared/logger.js';
import { MetricsRegistry } from './shared/metrics.js';
import { createDocumentStorage } from './storage/document-storage.js';
import { QUEUE_NAME } from './worker/jobs.js';
import { WorkerRuntime } from './worker/runtime.js';

export async function createServerRuntime() {
  const prisma = createPrismaClient(logger);
  const metrics = new MetricsRegistry();
  await prisma.$connect();
  const redis = createRedisConnection(env.REDIS_URL);
  await ensureRedisConnected(redis);
  const documentStorage = createDocumentStorage(env);
  const documentsRepository = new DocumentsRepository(prisma);
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  const auditService = new AuditService(prisma);
  const claimsService = new ClaimsService(new ClaimsRepository(prisma), auditService);
  const documentCleanup = new DocumentCleanupService({
    repository: documentsRepository,
    storage: documentStorage,
    queue,
    logger,
  });
  const reconciliationRepository = new ReconciliationRepository(prisma);
  const csvImport = new CsvImportService({ repository: reconciliationRepository, queue, logger });
  const claimsExport = new ClaimsExportService({
    repository: new ReportsRepository(prisma),
    claimsService,
    queue,
    logger,
    exportsDirectory: fileURLToPath(new URL('../uploads/exports/', import.meta.url)),
  });

  const workerRuntime = new WorkerRuntime({
    connection: redis,
    logger,
    concurrency: env.WORKER_CONCURRENCY,
    services: { documentCleanup, csvImport, claimsExport },
  });
  if (env.START_EMBEDDED_WORKER) await workerRuntime.start();
  await documentCleanup.recoverPending();
  await csvImport.recoverPending();
  await claimsExport.recoverPending();

  const healthService = new HealthService({
    database: { query: () => prisma.$queryRaw`SELECT 1` },
    redis,
    isWorkerReady: workerRuntime.isReady,
    workerRequired: env.START_EMBEDDED_WORKER,
    metrics,
  });
  const rateLimitNamespace =
    process.env.RUN_INFRA_INTEGRATION === 'true' ? `test-${randomUUID()}` : undefined;
  const rateLimiter = createGlobalRateLimiter({
    redis,
    windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
    limit: env.GLOBAL_RATE_LIMIT_MAX,
    namespace: rateLimitNamespace,
  });
  const loginRateLimiter = createLoginRateLimiter({
    redis,
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: env.LOGIN_RATE_LIMIT_MAX,
    namespace: rateLimitNamespace,
  });
  const authRepository = new AuthRepository(prisma);
  const authService = new AuthService({
    repository: authRepository,
    auditService,
    sessionTtlHours: env.SESSION_TTL_HOURS,
  });
  const authenticate = createAuthenticate({
    authService,
    cookieName: env.SESSION_COOKIE_NAME,
  });
  const csrfProtection = createCsrfProtection({ cookieName: env.CSRF_COOKIE_NAME });
  const authController = new AuthController({ authService, config: env });
  const authRouter = createAuthRouter({
    controller: authController,
    authenticate,
    csrfProtection,
    loginRateLimiter,
  });
  const referenceService = new ReferenceService(new ReferenceRepository(prisma), auditService);
  const referenceRouter = createReferenceRouter({
    controller: new ReferenceController(referenceService),
    authenticate,
    csrfProtection,
  });
  const claimsRouter = createClaimsRouter({
    controller: new ClaimsController(claimsService),
    authenticate,
    csrfProtection,
  });
  const payablesService = new PayablesService(new PayablesRepository(prisma), auditService);
  const payablesRouter = createPayablesRouter({
    controller: new PayablesController(payablesService),
    authenticate,
    csrfProtection,
  });
  const paymentsService = new PaymentsService(new PaymentsRepository(prisma), auditService);
  const paymentsRouter = createPaymentsRouter({
    controller: new PaymentsController(paymentsService),
    authenticate,
    csrfProtection,
  });
  const accountingRouter = createAccountingRouter({
    controller: new AccountingController(new AccountingRepository(prisma)),
    authenticate,
  });
  const reconciliationService = new ReconciliationService({
    repository: reconciliationRepository,
    auditService,
    csvImport,
    importsDirectory: fileURLToPath(new URL('../uploads/imports/', import.meta.url)),
  });
  const reconciliationRouter = createReconciliationRouter({
    controller: new ReconciliationController(reconciliationService),
    authenticate,
    csrfProtection,
  });
  const reportsRouter = createReportsRouter({
    controller: new ReportsController(claimsExport),
    authenticate,
    csrfProtection,
  });
  const auditRouter = createAuditRouter({
    controller: new AuditController(new AuditRepository(prisma)),
    authenticate,
  });
  const documentsService = new DocumentsService({
    repository: documentsRepository,
    auditService,
    storage: documentStorage,
    cleanupCoordinator: documentCleanup,
  });
  const documentsRouter = createDocumentsRouter({
    controller: new DocumentsController(documentsService),
    authenticate,
    csrfProtection,
    maxBytes: env.DOCUMENT_MAX_BYTES,
  });
  const app = createApp({
    config: env,
    logger,
    healthService,
    rateLimiter,
    authRouter,
    referenceRouter,
    claimsRouter,
    documentsRouter,
    payablesRouter,
    paymentsRouter,
    accountingRouter,
    reconciliationRouter,
    reportsRouter,
    auditRouter,
    metrics,
  });

  return {
    app,
    config: env,
    workerRuntime,
    async close() {
      await workerRuntime.close();
      await queue.close();
      await prisma.$disconnect();
      if (redis.status !== 'end') await redis.quit();
    },
  };
}
