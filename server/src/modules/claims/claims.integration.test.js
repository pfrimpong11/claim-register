import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServerRuntime } from '../../runtime.js';
import { ClaimsRepository } from './claims.repository.js';
import { ClaimsService } from './claims.service.js';

const describeWithInfrastructure =
  process.env.RUN_INFRA_INTEGRATION === 'true' ? describe : describe.skip;

describeWithInfrastructure('Phase 2 claim registration', () => {
  it('creates claim, reserve, status, and audit atomically with unique concurrent numbers', async () => {
    const runtime = await createServerRuntime();
    const cleanup = new PrismaClient();
    const agent = request.agent(runtime.app);
    const marker = `Phase2-${Date.now()}`;
    try {
      const login = await agent
        .post('/api/v1/auth/login')
        .send({ email: 'claims.officer@claims.local', password: process.env.SEED_DEFAULT_PASSWORD })
        .expect(200);
      const policies = await agent.get('/api/v1/policies?q=POL-').expect(200);
      const body = {
        policyId: policies.body.data[0].id,
        lossDate: '2026-08-01',
        notificationDate: '2026-08-02',
        lossNature: marker,
        estimatedLossAmount: '12500.50',
      };
      const [first, second] = await Promise.all([
        agent.post('/api/v1/claims').set('x-csrf-token', login.body.data.csrfToken).send(body),
        agent.post('/api/v1/claims').set('x-csrf-token', login.body.data.csrfToken).send(body),
      ]);
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.data.claimNumber).not.toBe(second.body.data.claimNumber);
      const register = await agent.get(`/api/v1/claims?lossNature=${marker}`).expect(200);
      expect(register.body.meta.total).toBe(2);
      expect(register.body.summaries[0].estimatedLoss).toBe('25001');
      const detail = await agent.get(`/api/v1/claims/${first.body.data.id}`).expect(200);
      expect(detail.body.data.reserves).toHaveLength(1);
      expect(detail.body.data.statusHistory[0].toStatus).toBe('RESERVED_NOT_SETTLED');
      expect(detail.body.data.estimatedLossAmount).toBe('12500.5');
    } finally {
      const claims = await cleanup.claim.findMany({
        where: { lossNature: marker },
        select: { id: true },
      });
      const ids = claims.map(({ id }) => id);
      await cleanup.auditLog.deleteMany({ where: { entityType: 'CLAIM', entityId: { in: ids } } });
      await cleanup.claimStatusHistory.deleteMany({ where: { claimId: { in: ids } } });
      await cleanup.claimReserve.deleteMany({ where: { claimId: { in: ids } } });
      await cleanup.claim.deleteMany({ where: { id: { in: ids } } });
      await cleanup.$disconnect();
      await runtime.close();
    }
  });

  it('rejects claim creation without the claims.create permission', async () => {
    const runtime = await createServerRuntime();
    const agent = request.agent(runtime.app);
    try {
      const login = await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'finance.officer@claims.local',
          password: process.env.SEED_DEFAULT_PASSWORD,
        })
        .expect(200);
      await agent
        .post('/api/v1/claims')
        .set('x-csrf-token', login.body.data.csrfToken)
        .send({})
        .expect(403);
    } finally {
      await runtime.close();
    }
  });

  it('rolls back claim, reserve, and status when the transactional audit fails', async () => {
    const prisma = new PrismaClient();
    const marker = `Rollback-${Date.now()}`;
    try {
      const policy = await prisma.policy.findFirstOrThrow();
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: 'claims.officer@claims.local' },
      });
      const service = new ClaimsService(new ClaimsRepository(prisma), {
        write: async () => {
          throw new Error('forced audit failure');
        },
      });
      await expect(
        service.create(
          {
            policyId: policy.id,
            lossDate: new Date('2026-07-01'),
            notificationDate: new Date('2026-07-02'),
            notificationOverrideReason: null,
            lossNature: marker,
            description: null,
            estimatedLossAmount: '1000',
          },
          { userId: user.id, correlationId: marker },
        ),
      ).rejects.toThrow('forced audit failure');
      expect(await prisma.claim.count({ where: { lossNature: marker } })).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
