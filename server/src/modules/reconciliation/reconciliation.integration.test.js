import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServerRuntime } from '../../runtime.js';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CsvImportService } from './csv-import.service.js';
import { ReconciliationRepository } from './reconciliation.repository.js';

const describeWithInfrastructure =
  process.env.RUN_INFRA_INTEGRATION === 'true' ? describe : describe.skip;
describeWithInfrastructure('Phase 6 reconciliation', () => {
  it('reports malformed and duplicate CSV rows without duplicating external transactions', async () => {
    const prisma = new PrismaClient();
    const repository = new ReconciliationRepository(prisma);
    const account = await prisma.settlementAccount.findUniqueOrThrow({
      where: { code: 'GCB-GHS' },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'finance.officer@claims.local' },
    });
    const marker = `CSV-${Date.now()}`;
    const storagePath = fileURLToPath(
      new URL(`../../../uploads/imports/${marker}.csv`, import.meta.url),
    );
    let importId;
    await fs.mkdir(fileURLToPath(new URL('../../../uploads/imports/', import.meta.url)), {
      recursive: true,
    });
    await fs.writeFile(
      storagePath,
      `externalReference,transactionDate,valueDate,transactionType,amount,currencyCode,description\n${marker},2026-09-02,,DEBIT,25.00,GHS,Valid\n${marker},2026-09-02,,DEBIT,25.00,GHS,Duplicate\nBROKEN,not-a-date,,DEBIT,10.00,GHS,Invalid\n`,
    );
    try {
      const item = await prisma.transactionImport.create({
        data: {
          sourceType: 'BANK_STATEMENT',
          settlementAccountId: account.id,
          sourceFileName: `${marker}.csv`,
          storagePath,
          importedBy: user.id,
        },
      });
      importId = item.id;
      const result = await new CsvImportService({ repository, logger: { info() {} } }).process({
        importId,
      });
      expect(result).toMatchObject({
        status: 'COMPLETED_WITH_ERRORS',
        importedRows: 1,
        duplicateRows: 1,
        failedRows: 1,
      });
      const persisted = await prisma.transactionImport.findUniqueOrThrow({
        where: { id: importId },
      });
      expect(persisted.errorSummary).toHaveLength(1);
    } finally {
      if (importId) {
        await prisma.externalTransaction.deleteMany({ where: { importId } });
        await prisma.transactionImport.delete({ where: { id: importId } }).catch(() => {});
      }
      await fs.unlink(storagePath).catch(() => {});
      await prisma.$disconnect();
    }
  });
  it('keeps successful payments unmatched, prevents concurrent overmatch, and reverses a mobile-money match', async () => {
    const runtime = await createServerRuntime();
    const prisma = new PrismaClient();
    const claimsManager = request.agent(runtime.app);
    const financeOfficer = request.agent(runtime.app);
    const financeManager = request.agent(runtime.app);
    const marker = `Phase6-${Date.now()}`;
    let claimId;
    let externalId;
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
          estimatedLossAmount: '100',
        })
        .expect(201);
      claimId = claim.body.data.id;
      const payable = await claimsManager
        .post(`/api/v1/claims/${claimId}/payables`)
        .set('x-csrf-token', cm)
        .send({ payeePartyId: parties.body.data[0].id, amount: '100' })
        .expect(201);
      await claimsManager
        .post(`/api/v1/payables/${payable.body.data.id}/approve`)
        .set('x-csrf-token', cm)
        .expect(200);
      const accounts = await financeOfficer.get('/api/v1/settlement-accounts').expect(200);
      const momo = accounts.body.data.find((a) => a.accountType === 'MOBILE_MONEY');
      const payment = await financeOfficer
        .post(`/api/v1/payables/${payable.body.data.id}/payments`)
        .set('x-csrf-token', fo)
        .set('idempotency-key', `${marker}-create`)
        .send({
          paymentDate: '2026-09-02',
          paymentAmount: '100',
          paymentCurrencyCode: 'GHS',
          fxRate: '1',
          settlementAccountId: momo.id,
        })
        .expect(201);
      await financeManager
        .post(`/api/v1/payments/${payment.body.data.id}/approve`)
        .set('x-csrf-token', fm)
        .set('idempotency-key', `${marker}-approve`)
        .expect(200);
      await financeOfficer
        .post(`/api/v1/payments/${payment.body.data.id}/mark-successful`)
        .set('x-csrf-token', fo)
        .set('idempotency-key', `${marker}-success`)
        .expect(200);
      let payments = await financeOfficer.get('/api/v1/reconciliation-payments').expect(200);
      expect(
        payments.body.data.find((p) => p.id === payment.body.data.id).reconciliationStatus,
      ).toBe('UNMATCHED');
      const external = await prisma.externalTransaction.create({
        data: {
          settlementAccountId: momo.id,
          externalReference: marker,
          transactionDate: new Date('2026-09-02'),
          transactionType: 'DEBIT',
          amount: '100',
          currencyCode: 'GHS',
          sourceType: 'MOMO_STATEMENT',
        },
      });
      externalId = external.id;
      const race = await Promise.all([
        match(financeOfficer, fo, payment.body.data.id, external.id, '60', `${marker}-match-a`),
        match(financeOfficer, fo, payment.body.data.id, external.id, '60', `${marker}-match-b`),
      ]);
      expect(race.map((response) => response.status).sort()).toEqual([201, 409]);
      const active = await prisma.reconciliationMatch.findFirstOrThrow({
        where: { externalTransactionId: external.id, status: 'ACTIVE' },
      });
      await financeManager
        .post(`/api/v1/payments/${payment.body.data.id}/reverse`)
        .set('x-csrf-token', fm)
        .set('idempotency-key', `${marker}-blocked-payment-reversal`)
        .send({ reason: 'Provider returned the transfer' })
        .expect(409);
      await financeOfficer
        .post(`/api/v1/reconciliation-matches/${active.id}/reverse`)
        .set('x-csrf-token', fo)
        .set('idempotency-key', `${marker}-unmatch`)
        .send({ reason: 'Evidence was selected in error' })
        .expect(200);
      expect(
        (await prisma.externalTransaction.findUniqueOrThrow({ where: { id: external.id } }))
          .reconciliationStatus,
      ).toBe('UNMATCHED');
      expect(
        (await prisma.reconciliationMatch.findUniqueOrThrow({ where: { id: active.id } })).status,
      ).toBe('REVERSED');
    } finally {
      if (externalId) {
        const matches = await prisma.reconciliationMatch.findMany({
          where: { externalTransactionId: externalId },
          select: { id: true },
        });
        await prisma.auditLog.deleteMany({
          where: { entityId: { in: matches.map((item) => item.id) } },
        });
        await prisma.reconciliationMatch.deleteMany({
          where: { externalTransactionId: externalId },
        });
        await prisma.externalTransaction.delete({ where: { id: externalId } }).catch(() => {});
      }
      if (claimId) {
        const paymentIds = (
          await prisma.claimPayment.findMany({ where: { claimId }, select: { id: true } })
        ).map((item) => item.id);
        const journals = (
          await prisma.journalEntry.findMany({ where: { claimId }, select: { id: true } })
        ).map((item) => item.id);
        await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journals } } });
        await prisma.journalEntry.deleteMany({ where: { id: { in: journals } } });
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
function match(agent, csrf, paymentId, externalTransactionId, matchedAmount, key) {
  return agent
    .post('/api/v1/reconciliation-matches')
    .set('x-csrf-token', csrf)
    .set('idempotency-key', key)
    .send({ paymentId, externalTransactionId, matchedAmount });
}
