import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServerRuntime } from '../../runtime.js';

const describeWithInfrastructure =
  process.env.RUN_INFRA_INTEGRATION === 'true' ? describe : describe.skip;
describeWithInfrastructure('audit viewer', () => {
  it('permits authorized filtered reads and rejects users without audit permission', async () => {
    const runtime = await createServerRuntime();
    const administrator = request.agent(runtime.app);
    const claimsOfficer = request.agent(runtime.app);
    try {
      await login(administrator, 'admin@claims.local');
      await login(claimsOfficer, 'claims.officer@claims.local');
      const result = await administrator
        .get('/api/v1/audit-logs?action=LOGIN&pageSize=5')
        .expect(200);
      expect(result.body.data.length).toBeGreaterThan(0);
      expect(result.body.data.every((entry) => entry.action.includes('LOGIN'))).toBe(true);
      expect(JSON.stringify(result.body.data)).not.toContain('passwordHash');
      await claimsOfficer.get('/api/v1/audit-logs').expect(403);
    } finally {
      await runtime.close();
    }
  });
});
async function login(agent, email) {
  await agent
    .post('/api/v1/auth/login')
    .send({ email, password: process.env.SEED_DEFAULT_PASSWORD })
    .expect(200);
}
