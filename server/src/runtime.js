import { createApp } from './app.js';
import { Queue } from 'bullmq';
import { env } from './config/env.js';
import { createPrismaClient } from './infrastructure/prisma.js';
import { createRedisConnection, ensureRedisConnected } from './infrastructure/redis.js';
import { createAuthenticate } from './middleware/authenticate.js';
import { createCsrfProtection } from './middleware/csrf.js';
import { AuditService } from './modules/audit/audit.service.js';
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
import { createGlobalRateLimiter, createLoginRateLimiter } from './security/rate-limit.js';
import { logger } from './shared/logger.js';
import { createDocumentStorage } from './storage/document-storage.js';
import { QUEUE_NAME } from './worker/jobs.js';
import { WorkerRuntime } from './worker/runtime.js';

export async function createServerRuntime() {
  const prisma = createPrismaClient(logger);
  await prisma.$connect();
  const redis = createRedisConnection(env.REDIS_URL);
  await ensureRedisConnected(redis);
  const documentStorage = createDocumentStorage(env);
  const documentsRepository = new DocumentsRepository(prisma);
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  const documentCleanup = new DocumentCleanupService({
    repository: documentsRepository,
    storage: documentStorage,
    queue,
    logger,
  });

  const workerRuntime = new WorkerRuntime({
    connection: redis,
    logger,
    concurrency: env.WORKER_CONCURRENCY,
    services: { documentCleanup },
  });
  if (env.START_EMBEDDED_WORKER) await workerRuntime.start();
  await documentCleanup.recoverPending();

  const healthService = new HealthService({
    database: { query: () => prisma.$queryRaw`SELECT 1` },
    redis,
    isWorkerReady: workerRuntime.isReady,
    workerRequired: env.START_EMBEDDED_WORKER,
  });
  const rateLimiter = createGlobalRateLimiter({
    redis,
    windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
    limit: env.GLOBAL_RATE_LIMIT_MAX,
  });
  const loginRateLimiter = createLoginRateLimiter({
    redis,
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: env.LOGIN_RATE_LIMIT_MAX,
  });
  const authRepository = new AuthRepository(prisma);
  const auditService = new AuditService(prisma);
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
  const claimsService = new ClaimsService(new ClaimsRepository(prisma), auditService);
  const claimsRouter = createClaimsRouter({
    controller: new ClaimsController(claimsService),
    authenticate,
    csrfProtection,
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
