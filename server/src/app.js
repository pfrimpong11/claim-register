import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { requestContext } from './middleware/request-context.js';
import { createHealthRouter } from './modules/health/health.routes.js';

/**
 * @param {object} input
 * @param {ReturnType<import('./config/env.js').parseEnvironment>} input.config
 * @param {import('pino').Logger} input.logger
 * @param {import('./modules/health/health.service.js').HealthService} input.healthService
 * @param {import('express').RequestHandler} input.rateLimiter
 * @param {import('express').Router} [input.authRouter]
 * @param {import('express').Router} [input.referenceRouter]
 * @param {import('express').Router} [input.claimsRouter]
 * @param {import('express').Router} [input.documentsRouter]
 * @param {import('express').Router} [input.payablesRouter]
 * @param {import('express').Router} [input.paymentsRouter]
 * @param {import('express').Router} [input.accountingRouter]
 */
export function createApp({
  config,
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
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);

  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (request) => request.id,
      customProps: (request) => ({ correlationId: request.id }),
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-CSRF-Token'],
      origin(origin, callback) {
        if (!origin || config.CLIENT_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
    }),
  );
  app.use(rateLimiter);
  app.use(express.json({ limit: config.BODY_LIMIT, strict: true }));
  app.use(express.urlencoded({ extended: false, limit: config.BODY_LIMIT, parameterLimit: 50 }));
  app.use(cookieParser());
  app.use(hpp());

  app.use('/api/v1/health', createHealthRouter(healthService));
  if (authRouter) app.use('/api/v1/auth', authRouter);
  if (referenceRouter) app.use('/api/v1', referenceRouter);
  if (claimsRouter) app.use('/api/v1/claims', claimsRouter);
  if (documentsRouter) app.use('/api/v1', documentsRouter);
  if (payablesRouter) app.use('/api/v1', payablesRouter);
  if (paymentsRouter) app.use('/api/v1', paymentsRouter);
  if (accountingRouter) app.use('/api/v1', accountingRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
