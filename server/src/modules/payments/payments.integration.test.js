import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServerRuntime } from '../../runtime.js';
const describeWithInfrastructure =
  process.env.RUN_INFRA_INTEGRATION === 'true' ? describe : describe.skip;
describeWithInfrastructure('Phase 5 payments and FX', () => {
  it('handles FX, idempotency, full payment, reversal, journals, and concurrent overpayment', async () => {
    const runtime = await createServerRuntime();
    const prisma = new PrismaClient();
    const claimsManager = request.agent(runtime.app);
    const financeOfficer = request.agent(runtime.app);
    const financeManager = request.agent(runtime.app);
    const marker = `Phase5-${Date.now()}`;
    let claimId;
    try {
      const cm = await login(claimsManager, 'claims.manager@claims.local');
      const fo = await login(financeOfficer, 'finance.officer@claims.local');
      const fm = await login(financeManager, 'finance.manager@claims.local');
      const policies = await claimsManager.get('/api/v1/policies?q=POL-').expect(200);
      const parties = await claimsManager.get('/api/v1/parties?q=&limit=10').expect(200);
      const claim = await claimsManager
        .post('/api/v1/claims')
        .set('x-csrf-token', cm)
        .send({
          policyId: policies.body.data.find((p) => p.currencyCode === 'GHS').id,
          lossDate: '2026-09-01',
          notificationDate: '2026-09-02',
          lossNature: marker,
          estimatedLossAmount: '1500',
        })
        .expect(201);
      claimId = claim.body.data.id;
      const payable = await claimsManager
        .post(`/api/v1/claims/${claimId}/payables`)
        .set('x-csrf-token', cm)
        .send({ payeePartyId: parties.body.data[0].id, amount: '1000', description: 'Indemnity' })
        .expect(201);
      await claimsManager
        .post(`/api/v1/payables/${payable.body.data.id}/approve`)
        .set('x-csrf-token', cm)
        .expect(200);
      const accounts = await financeOfficer.get('/api/v1/settlement-accounts').expect(200);
      const usd = accounts.body.data.find((a) => a.currencyCode === 'USD');
      const ghs = accounts.body.data.find((a) => a.currencyCode === 'GHS');
      const crossBody = {
        paymentDate: '2026-09-02',
        paymentAmount: '100',
        paymentCurrencyCode: 'USD',
        fxRate: '5',
        settlementAccountId: usd.id,
        reference: 'FX-1',
      };
      const first = await financeOfficer
        .post(`/api/v1/payables/${payable.body.data.id}/payments`)
        .set('x-csrf-token', fo)
        .set('idempotency-key', `${marker}-create-cross`)
        .send(crossBody)
        .expect(201);
      const replay = await financeOfficer
        .post(`/api/v1/payables/${payable.body.data.id}/payments`)
        .set('x-csrf-token', fo)
        .set('idempotency-key', `${marker}-create-cross`)
        .send(crossBody)
        .expect(201);
      expect(replay.body.data.id).toBe(first.body.data.id);
      expect(first.body.data.settlementAmount).toBe('500');
      await approve(financeManager, fm, first.body.data.id, `${marker}-approve-cross`);
      await succeed(financeOfficer, fo, first.body.data.id, `${marker}-success-cross`, 200);
      const second = await createPayment(
        financeOfficer,
        fo,
        payable.body.data.id,
        ghs.id,
        '500',
        `${marker}-create-final`,
      );
      await approve(financeManager, fm, second.id, `${marker}-approve-final`);
      await succeed(financeOfficer, fo, second.id, `${marker}-success-final`, 200);
      let detail = await financeOfficer.get(`/api/v1/claims/${claimId}`).expect(200);
      expect(detail.body.data.paidAmount).toBe('1000');
      expect(detail.body.data.outstandingAmount).toBe('0');
      expect(detail.body.data.financialStatus).toBe('SETTLED_AND_PAID');
      await financeManager
        .post(`/api/v1/payments/${second.id}/reverse`)
        .set('x-csrf-token', fm)
        .set('idempotency-key', `${marker}-reverse`)
        .send({ reason: 'Provider returned the transfer' })
        .expect(200);
      detail = await financeOfficer.get(`/api/v1/claims/${claimId}`).expect(200);
      expect(detail.body.data.paidAmount).toBe('500');
      expect(detail.body.data.financialStatus).toBe('SETTLED_PAYMENT_OUTSTANDING');
      const raceA = await createPayment(
        financeOfficer,
        fo,
        payable.body.data.id,
        ghs.id,
        '400',
        `${marker}-race-a`,
      );
      const raceB = await createPayment(
        financeOfficer,
        fo,
        payable.body.data.id,
        ghs.id,
        '400',
        `${marker}-race-b`,
      );
      await approve(financeManager, fm, raceA.id, `${marker}-approve-a`);
      await approve(financeManager, fm, raceB.id, `${marker}-approve-b`);
      const race = await Promise.all([
        succeed(financeOfficer, fo, raceA.id, `${marker}-success-a`),
        succeed(financeOfficer, fo, raceB.id, `${marker}-success-b`),
      ]);
      expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
      const register = await financeOfficer
        .get(`/api/v1/claims?lossNature=${marker}&status=SETTLED_PAYMENT_OUTSTANDING`)
        .expect(200);
      expect(register.body.meta.total).toBe(1);
      expect(register.body.summaries[0].paidAmount).toBe('900');
      expect(register.body.summaries[0].outstandingAmount).toBe('100');

      await financeOfficer
        .post(`/api/v1/payables/${payable.body.data.id}/payments`)
        .set('x-csrf-token', fo)
        .set('idempotency-key', `${marker}-overpayment-rejected-at-create`)
        .send({
          paymentDate: '2026-09-02',
          paymentAmount: '150',
          paymentCurrencyCode: 'GHS',
          fxRate: '1',
          settlementAccountId: ghs.id,
        })
        .expect(409)
        .expect((response) => {
          expect(response.body.error.code).toBe('PAYMENT_OVERPAYMENT_CONFIRMATION_REQUIRED');
          expect(response.body.error.details.overpayment).toBe('50');
        });
      const overpayment = (
        await financeOfficer
          .post(`/api/v1/payables/${payable.body.data.id}/payments`)
          .set('x-csrf-token', fo)
          .set('idempotency-key', `${marker}-overpayment-create`)
          .send({
            paymentDate: '2026-09-02',
            paymentAmount: '150',
            paymentCurrencyCode: 'GHS',
            fxRate: '1',
            settlementAccountId: ghs.id,
            confirmOverpayment: true,
            overpaymentReason: 'External bank transfer exceeded the approved balance',
          })
          .expect(201)
      ).body.data;
      await approve(financeManager, fm, overpayment.id, `${marker}-overpayment-approve`);
      await succeed(
        financeOfficer,
        fo,
        overpayment.id,
        `${marker}-overpayment-success-rejected`,
        409,
      );
      const overpaymentSuccess = await succeed(
        financeOfficer,
        fo,
        overpayment.id,
        `${marker}-overpayment-success`,
        200,
        {
          confirmOverpayment: true,
          overpaymentReason: 'External bank transfer exceeded the approved balance',
        },
      );
      expect(overpaymentSuccess.body.data.overpaymentAmount).toBe('50');
      expect(
        overpaymentSuccess.body.data.journals[0].lines.map((line) => [
          line.glAccount.code,
          line.debitAmount,
          line.creditAmount,
        ]),
      ).toEqual(
        expect.arrayContaining([
          ['CLAIMS_PAYABLE', '100', '0'],
          ['CLAIMS_OVERPAYMENT_RECEIVABLE', '50', '0'],
          ['SETTLEMENT_ASSETS', '0', '150'],
        ]),
      );
      detail = await financeOfficer.get(`/api/v1/claims/${claimId}`).expect(200);
      expect(detail.body.data.paidAmount).toBe('1050');
      expect(detail.body.data.balanceAmount).toBe('-50');
      expect(detail.body.data.outstandingAmount).toBe('0');
      expect(detail.body.data.overpaidAmount).toBe('50');
      expect(detail.body.data.financialStatus).toBe('SETTLED_AND_PAID');
      const overpaymentReversal = await financeManager
        .post(`/api/v1/payments/${overpayment.id}/reverse`)
        .set('x-csrf-token', fm)
        .set('idempotency-key', `${marker}-overpayment-reverse`)
        .send({ reason: 'The recipient returned the excess transfer' })
        .expect(200);
      expect(
        overpaymentReversal.body.data.journals[0].lines.map((line) => [
          line.glAccount.code,
          line.debitAmount,
          line.creditAmount,
        ]),
      ).toEqual(
        expect.arrayContaining([
          ['CLAIMS_PAYABLE', '0', '100'],
          ['CLAIMS_OVERPAYMENT_RECEIVABLE', '0', '50'],
          ['SETTLEMENT_ASSETS', '150', '0'],
        ]),
      );
      detail = await financeOfficer.get(`/api/v1/claims/${claimId}`).expect(200);
      expect(detail.body.data.paidAmount).toBe('900');
      expect(detail.body.data.outstandingAmount).toBe('100');
      expect(detail.body.data.overpaidAmount).toBe('0');
      expect(detail.body.data.financialStatus).toBe('SETTLED_PAYMENT_OUTSTANDING');
      const journals = await financeOfficer.get('/api/v1/accounting/journals').expect(200);
      expect(journals.body.data.some((journal) => journal.claimId === claimId)).toBe(true);
      expect(
        await prisma.journalEntry.count({
          where: { claimId, sourceType: { in: ['CLAIM_PAYMENT', 'PAYMENT_REVERSAL'] } },
        }),
      ).toBe(6);
    } finally {
      if (claimId) {
        const paymentIds = (
          await prisma.claimPayment.findMany({ where: { claimId }, select: { id: true } })
        ).map((x) => x.id);
        const journalIds = (
          await prisma.journalEntry.findMany({ where: { claimId }, select: { id: true } })
        ).map((x) => x.id);
        await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
        await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
        await prisma.idempotencyKey.deleteMany({ where: { key: { startsWith: marker } } });
        await prisma.auditLog.deleteMany({
          where: { OR: [{ entityId: claimId }, { entityId: { in: paymentIds } }] },
        });
        await prisma.claimPayment.deleteMany({ where: { claimId } });
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
async function login(agent, email) {
  return (
    await agent
      .post('/api/v1/auth/login')
      .send({ email, password: process.env.SEED_DEFAULT_PASSWORD })
      .expect(200)
  ).body.data.csrfToken;
}
async function createPayment(agent, csrf, payableId, accountId, amount, key) {
  return (
    await agent
      .post(`/api/v1/payables/${payableId}/payments`)
      .set('x-csrf-token', csrf)
      .set('idempotency-key', key)
      .send({
        paymentDate: '2026-09-02',
        paymentAmount: amount,
        paymentCurrencyCode: 'GHS',
        fxRate: '1',
        settlementAccountId: accountId,
      })
      .expect(201)
  ).body.data;
}
async function approve(agent, csrf, id, key) {
  return agent
    .post(`/api/v1/payments/${id}/approve`)
    .set('x-csrf-token', csrf)
    .set('idempotency-key', key)
    .expect(200);
}
async function succeed(agent, csrf, id, key, expected, body) {
  const response = await agent
    .post(`/api/v1/payments/${id}/mark-successful`)
    .set('x-csrf-token', csrf)
    .set('idempotency-key', key)
    .send(body ?? {});
  if (expected) expect(response.status).toBe(expected);
  return response;
}
