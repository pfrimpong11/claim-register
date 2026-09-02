import expressRateLimit from 'express-rate-limit';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { parseEnvironment } from './config/env.js';
import { HealthService } from './modules/health/health.service.js';
import { logger } from './shared/logger.js';

function createTestApp({ databaseReady = true, redisReady = true, workerReady = true } = {}) {
  const healthService = new HealthService({
    database: {
      query: databaseReady ? vi.fn().mockResolvedValue({}) : vi.fn().mockRejectedValue(new Error()),
    },
    redis: {
      ping: redisReady ? vi.fn().mockResolvedValue('PONG') : vi.fn().mockRejectedValue(new Error()),
    },
    isWorkerReady: () => workerReady,
    workerRequired: true,
  });

  return createApp({
    config: parseEnvironment({ NODE_ENV: 'test', CLIENT_ORIGINS: 'http://localhost:3000' }),
    logger,
    healthService,
    rateLimiter: expressRateLimit({ limit: 100, windowMs: 60_000 }),
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
});
