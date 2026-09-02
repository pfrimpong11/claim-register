import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServerRuntime } from '../../runtime.js';

const describeWithInfrastructure =
  process.env.RUN_INFRA_INTEGRATION === 'true' ? describe : describe.skip;

describeWithInfrastructure('Phase 4 indemnity payable and ledger', () => {
  it('creates and approves one indemnity payable with one balanced journal', async () => {
    const runtime = await createServerRuntime();
    const prisma = new PrismaClient();
    const officer = request.agent(runtime.app);
    const manager = request.agent(runtime.app);
    const marker = `Phase4-${Date.now()}`;
    /** @type {string | undefined} */ let claimId;
    try {
      const officerLogin = await officer
        .post('/api/v1/auth/login')
        .send({ email: 'claims.officer@claims.local', password: process.env.SEED_DEFAULT_PASSWORD })
        .expect(200);
      const managerLogin = await manager
        .post('/api/v1/auth/login')
        .send({ email: 'claims.manager@claims.local', password: process.env.SEED_DEFAULT_PASSWORD })
        .expect(200);
      const policies = await officer.get('/api/v1/policies?q=POL-').expect(200);
      const parties = await officer.get('/api/v1/parties?q=&limit=10').expect(200);
      const claim = await officer
        .post('/api/v1/claims')
        .set('x-csrf-token', officerLogin.body.data.csrfToken)
        .send({
          policyId: policies.body.data[0].id,
          lossDate: '2026-09-01',
          notificationDate: '2026-09-02',
          lossNature: marker,
          estimatedLossAmount: '9000',
        })
        .expect(201);
      claimId = claim.body.data.id;
      const created = await officer
        .post(`/api/v1/claims/${claimId}/payables`)
        .set('x-csrf-token', officerLogin.body.data.csrfToken)
        .send({
          payeePartyId: parties.body.data[0].id,
          amount: '2500.50',
          description: 'Approved indemnity',
        })
        .expect(201);
      expect(created.body.data.payableType).toBe('INDEMNITY');
      await officer
        .post(`/api/v1/payables/${created.body.data.id}/approve`)
        .set('x-csrf-token', officerLogin.body.data.csrfToken)
        .expect(403);
      const approved = await manager
        .post(`/api/v1/payables/${created.body.data.id}/approve`)
        .set('x-csrf-token', managerLogin.body.data.csrfToken)
        .expect(200);
      expect(approved.body.data.journal.lines).toHaveLength(2);
      expect(
        approved.body.data.journal.lines.map((line) => [line.debitAmount, line.creditAmount]),
      ).toEqual(
        expect.arrayContaining([
          ['2500.5', '0'],
          ['0', '2500.5'],
        ]),
      );
      await manager
        .post(`/api/v1/payables/${created.body.data.id}/approve`)
        .set('x-csrf-token', managerLogin.body.data.csrfToken)
        .expect(409);
      expect(
        await prisma.journalEntry.count({
          where: { sourceType: 'CLAIM_PAYABLE', sourceId: created.body.data.id },
        }),
      ).toBe(1);
      const detail = await officer.get(`/api/v1/claims/${claimId}`).expect(200);
      expect(detail.body.data.approvedAmount).toBe('2500.5');
      expect(detail.body.data.outstandingAmount).toBe('2500.5');
      expect(detail.body.data.financialStatus).toBe('SETTLED_PAYMENT_OUTSTANDING');

      const cancelled = await officer
        .post(`/api/v1/claims/${claimId}/payables`)
        .set('x-csrf-token', officerLogin.body.data.csrfToken)
        .send({ payeePartyId: parties.body.data[0].id, amount: '100', description: 'Cancel me' })
        .expect(201);
      await officer
        .post(`/api/v1/payables/${cancelled.body.data.id}/cancel`)
        .set('x-csrf-token', officerLogin.body.data.csrfToken)
        .send({ reason: 'Entered in error' })
        .expect(200);
      expect(
        (await prisma.claimPayable.findUniqueOrThrow({ where: { id: cancelled.body.data.id } }))
          .status,
      ).toBe('CANCELLED');

      const rollback = await officer
        .post(`/api/v1/claims/${claimId}/payables`)
        .set('x-csrf-token', officerLogin.body.data.csrfToken)
        .send({
          payeePartyId: parties.body.data[0].id,
          amount: '150',
          description: 'Rollback check',
        })
        .expect(201);
      await prisma.gLAccount.update({
        where: { code: 'CLAIMS_EXPENSE' },
        data: { isActive: false },
      });
      await manager
        .post(`/api/v1/payables/${rollback.body.data.id}/approve`)
        .set('x-csrf-token', managerLogin.body.data.csrfToken)
        .expect(503);
      expect(
        (await prisma.claimPayable.findUniqueOrThrow({ where: { id: rollback.body.data.id } }))
          .status,
      ).toBe('DRAFT');
      expect(
        await prisma.journalEntry.count({
          where: { sourceType: 'CLAIM_PAYABLE', sourceId: rollback.body.data.id },
        }),
      ).toBe(0);
      await prisma.gLAccount.update({
        where: { code: 'CLAIMS_EXPENSE' },
        data: { isActive: true },
      });
    } finally {
      await prisma.gLAccount.updateMany({
        where: { code: 'CLAIMS_EXPENSE' },
        data: { isActive: true },
      });
      if (claimId) {
        const payableIds = (
          await prisma.claimPayable.findMany({ where: { claimId }, select: { id: true } })
        ).map((x) => x.id);
        const journalIds = (
          await prisma.journalEntry.findMany({ where: { claimId }, select: { id: true } })
        ).map((x) => x.id);
        await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
        await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
        await prisma.auditLog.deleteMany({ where: { entityId: { in: [claimId, ...payableIds] } } });
        await prisma.claimPayable.deleteMany({ where: { claimId } });
        await prisma.claimStatusHistory.deleteMany({ where: { claimId } });
        await prisma.claimReserve.deleteMany({ where: { claimId } });
        await prisma.claim.deleteMany({ where: { id: claimId } });
      }
      await prisma.$disconnect();
      await runtime.close();
    }
  });
});
