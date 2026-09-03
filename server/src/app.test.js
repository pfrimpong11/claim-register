import expressRateLimit from 'express-rate-limit';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { parseEnvironment } from './config/env.js';
import { HealthService } from './modules/health/health.service.js';
import { logger } from './shared/logger.js';
import { MetricsRegistry } from './shared/metrics.js';
import { errorHandler } from './middleware/error-handler.js';

function createTestApp({
  databaseReady = true,
  redisReady = true,
  workerReady = true,
  rateLimit = 100,
} = {}) {
  const metrics = new MetricsRegistry();
  const healthService = new HealthService({
    database: {
      query: databaseReady ? vi.fn().mockResolvedValue({}) : vi.fn().mockRejectedValue(new Error()),
    },
    redis: {
      ping: redisReady ? vi.fn().mockResolvedValue('PONG') : vi.fn().mockRejectedValue(new Error()),
    },
    isWorkerReady: () => workerReady,
    workerRequired: true,
    metrics,
  });

  return createApp({
    config: parseEnvironment({ NODE_ENV: 'test', CLIENT_ORIGINS: 'http://localhost:3000' }),
    logger,
    healthService,
    rateLimiter: expressRateLimit({ limit: rateLimit, windowMs: 60_000 }),
    metrics,
  });
}

describe('application foundation', () => {
  it('reports liveness and provides a correlation id', async () => {
    const response = await request(createTestApp()).get('/api/v1/health/live').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('reports dependency readiness', async () => {
    const response = await request(createTestApp()).get('/api/v1/health/ready').expect(200);
    expect(response.body).toEqual({
      status: 'ready',
      checks: { database: true, redis: true, worker: true },
    });
  });

  it('fails readiness when a required dependency is unavailable', async () => {
    const response = await request(createTestApp({ redisReady: false }))
      .get('/api/v1/health/ready')
      .expect(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks.redis).toBe(false);
  });

  it('does not grant CORS access to an unlisted origin', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/health/live')
      .set('Origin', 'https://attacker.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('grants credentialed CORS access only to a listed origin', async () => {
    const response = await request(createTestApp())
      .options('/api/v1/health/live')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('returns stable errors without stack traces', async () => {
    const response = await request(createTestApp()).get('/missing').expect(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(response.body.error.correlationId).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('returns 429 under bounded request abuse and exposes non-sensitive metrics', async () => {
    const app = createTestApp({ rateLimit: 2 });
    await request(app).get('/api/v1/health/live').expect(200);
    await request(app).get('/api/v1/health/live').expect(200);
    await request(app).get('/api/v1/health/live').expect(429);
    const metrics = await request(createTestApp()).get('/api/v1/health/metrics').expect(200);
    expect(metrics.body).toHaveProperty('http');
    expect(JSON.stringify(metrics.body)).not.toMatch(/cookie|authorization|password/i);
  });

  it('maps a serializable write conflict to a safe retryable response', async () => {
    const app = express();
    app.get('/conflict', () => {
      throw Object.assign(new Error('database details'), { code: 'P2034' });
    });
    app.use(errorHandler);
    const response = await request(app).get('/conflict').expect(409);
    expect(response.body.error.code).toBe('CONCURRENT_WRITE_CONFLICT');
    expect(response.body.error.message).not.toContain('database details');
  });

  it('maps a raw-query PostgreSQL serialization conflict to a safe retryable response', async () => {
    const app = express();
    app.get('/raw-conflict', () => {
      throw Object.assign(new Error('raw database details'), {
        code: 'P2010',
        meta: { code: '40001' },
      });
    });
    app.use(errorHandler);
    const response = await request(app).get('/raw-conflict').expect(409);
    expect(response.body.error.code).toBe('CONCURRENT_WRITE_CONFLICT');
    expect(response.body.error.message).not.toContain('raw database details');
  });
});
