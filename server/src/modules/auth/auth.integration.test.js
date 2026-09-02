import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServerRuntime } from '../../runtime.js';

const describeWithInfrastructure =
  process.env.RUN_INFRA_INTEGRATION === 'true' ? describe : describe.skip;

describeWithInfrastructure('authentication integration', () => {
  it('logs in, resolves the principal, enforces CSRF, and revokes the session', async () => {
    const runtime = await createServerRuntime();
    const agent = request.agent(runtime.app);
    try {
      const login = await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@claims.local',
          password: process.env.SEED_DEFAULT_PASSWORD,
        })
        .expect(200);
      expect(login.body.data.user.permissions).toContain('users.manage');
      expect(login.headers['set-cookie']).toHaveLength(2);

      const me = await agent.get('/api/v1/auth/me').expect(200);
      expect(me.body.data.user.email).toBe('admin@claims.local');

      await agent.post('/api/v1/auth/logout').set('x-csrf-token', 'wrong').expect(403);
      await agent
        .post('/api/v1/auth/logout')
        .set('x-csrf-token', login.body.data.csrfToken)
        .expect(204);
      await agent.get('/api/v1/auth/me').expect(401);
    } finally {
      await runtime.close();
    }
  });
});
