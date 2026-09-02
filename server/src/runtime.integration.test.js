import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServerRuntime } from './runtime.js';

const describeWithInfrastructure =
  process.env.RUN_INFRA_INTEGRATION === 'true' ? describe : describe.skip;

describeWithInfrastructure('server runtime integration', () => {
  it('becomes ready with PostgreSQL, Redis, and the embedded worker', async () => {
    const runtime = await createServerRuntime();
    try {
      const response = await request(runtime.app).get('/api/v1/health/ready').expect(200);
      expect(response.body).toEqual({
        status: 'ready',
        checks: { database: true, redis: true, worker: true },
      });
    } finally {
      await runtime.close();
    }
  });
});
