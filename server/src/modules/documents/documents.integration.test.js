import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { createServerRuntime } from '../../runtime.js';

const describeWithInfrastructure =
  process.env.RUN_INFRA_INTEGRATION === 'true' ? describe : describe.skip;

describeWithInfrastructure('claim documents integration', () => {
  it('enforces permissions and completes the local upload/list/download/deactivate journey', async () => {
    const runtime = await createServerRuntime();
    const prisma = new PrismaClient();
    try {
      const admin = request.agent(runtime.app);
      const login = await admin
        .post('/api/v1/auth/login')
        .send({ email: 'admin@claims.local', password: process.env.SEED_DEFAULT_PASSWORD })
        .expect(200);
      const policies = await admin.get('/api/v1/policies?limit=1').expect(200);
      const claim = await admin
        .post('/api/v1/claims')
        .set('x-csrf-token', login.body.data.csrfToken)
        .send({
          policyId: policies.body.data[0].id,
          lossDate: '2026-08-30',
          notificationDate: '2026-08-31',
          lossNature: 'Document integration fixture',
          description: 'Safe fictional integration data',
          estimatedLossAmount: '1000.00',
        })
        .expect(201);
      const claimId = claim.body.data.id;
      const pdf = Buffer.from('%PDF-1.4\n%integration fixture\n');
      await admin
        .post(`/api/v1/claims/${claimId}/documents`)
        .set('x-csrf-token', login.body.data.csrfToken)
        .field('documentType', 'CLAIM_FORM')
        .attach('file', Buffer.from('spoofed'), {
          filename: 'spoofed.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
      const uploaded = await admin
        .post(`/api/v1/claims/${claimId}/documents`)
        .set('x-csrf-token', login.body.data.csrfToken)
        .field('documentType', 'CLAIM_FORM')
        .field('description', 'Integration fixture')
        .attach('file', pdf, { filename: 'claim-form.pdf', contentType: 'application/pdf' })
        .expect(201);
      expect(uploaded.body.data).toMatchObject({
        documentType: 'CLAIM_FORM',
        originalFileName: 'claim-form.pdf',
        storageProvider: 'LOCAL',
      });
      expect(uploaded.body.data.storageKey).toBeUndefined();
      const documentId = uploaded.body.data.id;
      const listed = await admin.get(`/api/v1/claims/${claimId}/documents`).expect(200);
      expect(listed.body.data.map((item) => item.id)).toContain(documentId);
      await admin
        .get(`/api/v1/documents/${documentId}/download`)
        .expect('content-type', 'application/pdf')
        .expect(200);
      await admin
        .post(`/api/v1/documents/${documentId}/deactivate`)
        .set('x-csrf-token', login.body.data.csrfToken)
        .expect(204);
      await admin.get(`/api/v1/documents/${documentId}/download`).expect(404);
      let cleanupStatus = 'PENDING';
      for (let attempt = 0; attempt < 20 && cleanupStatus !== 'COMPLETED'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        cleanupStatus =
          (await prisma.claimDocument.findUnique({ where: { id: documentId } }))?.cleanupStatus ??
          '';
      }
      expect(cleanupStatus).toBe('COMPLETED');

      const finance = request.agent(runtime.app);
      await finance
        .post('/api/v1/auth/login')
        .send({
          email: 'finance.officer@claims.local',
          password: process.env.SEED_DEFAULT_PASSWORD,
        })
        .expect(200);
      await finance.get(`/api/v1/claims/${claimId}/documents`).expect(403);
    } finally {
      await prisma.$disconnect();
      await runtime.close();
    }
  });
});
