import argon2 from 'argon2';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PartyType, PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  ['claims.create', 'Create claims', 'claims'],
  ['claims.view', 'View claims', 'claims'],
  ['claims.update', 'Update claims', 'claims'],
  ['reserves.create', 'Create reserves', 'reserves'],
  ['reserves.adjust', 'Adjust reserves', 'reserves'],
  ['payables.create', 'Create payables', 'payables'],
  ['payables.view', 'View payables', 'payables'],
  ['payables.approve', 'Approve payables', 'payables'],
  ['payables.cancel', 'Cancel draft payables', 'payables'],
  ['payments.create', 'Create payments', 'payments'],
  ['payments.view', 'View payments', 'payments'],
  ['payments.approve', 'Approve payments', 'payments'],
  ['payments.succeed', 'Mark payments successful', 'payments'],
  ['payments.reverse', 'Reverse payments', 'payments'],
  ['reconciliation.view', 'View reconciliation', 'reconciliation'],
  ['reconciliation.import', 'Import external transactions', 'reconciliation'],
  ['reconciliation.match', 'Match transactions', 'reconciliation'],
  ['reconciliation.unmatch', 'Unmatch transactions', 'reconciliation'],
  ['accounting.view', 'View journals', 'accounting'],
  ['reports.view', 'View reports', 'reports'],
  ['reports.export', 'Export reports', 'reports'],
  ['parties.view', 'View parties', 'parties'],
  ['parties.create', 'Create parties', 'parties'],
  ['policies.view', 'View policies', 'policies'],
  ['policies.create', 'Create policies', 'policies'],
  ['documents.view', 'View documents', 'documents'],
  ['documents.upload', 'Upload documents', 'documents'],
  ['documents.deactivate', 'Deactivate documents', 'documents'],
  ['users.manage', 'Manage users', 'access'],
  ['roles.manage', 'Manage roles', 'access'],
  ['permissions.manage', 'Manage permissions', 'access'],
  ['audit.view', 'View audit logs', 'audit'],
];

const roleDefinitions = [
  {
    code: 'ADMIN',
    name: 'Admin',
    description: 'Full exercise access.',
    permissions: permissions.map(([code]) => code),
  },
  {
    code: 'CLAIMS_OFFICER',
    name: 'Claims Officer',
    description: 'Registers and maintains claims and supporting reference data.',
    permissions: [
      'claims.create',
      'claims.view',
      'claims.update',
      'reserves.create',
      'payables.create',
      'payables.view',
      'payables.cancel',
      'parties.view',
      'parties.create',
      'policies.view',
      'policies.create',
      'documents.view',
      'documents.upload',
      'documents.deactivate',
    ],
  },
  {
    code: 'CLAIMS_MANAGER',
    name: 'Claims Manager',
    description: 'Reviews claims and approves indemnity payables.',
    permissions: [
      'claims.create',
      'claims.view',
      'claims.update',
      'reserves.create',
      'reserves.adjust',
      'payables.create',
      'payables.view',
      'payables.approve',
      'payables.cancel',
      'accounting.view',
      'parties.view',
      'parties.create',
      'policies.view',
      'policies.create',
      'documents.view',
      'documents.upload',
      'documents.deactivate',
      'reports.view',
    ],
  },
  {
    code: 'FINANCE_OFFICER',
    name: 'Finance Officer',
    description: 'Records payments and performs reconciliation.',
    permissions: [
      'claims.view',
      'payables.view',
      'payments.create',
      'payments.view',
      'payments.succeed',
      'reconciliation.view',
      'reconciliation.import',
      'reconciliation.match',
      'reconciliation.unmatch',
      'accounting.view',
    ],
  },
  {
    code: 'FINANCE_MANAGER',
    name: 'Finance Manager',
    description: 'Approves/reverses payments and oversees finance reporting.',
    permissions: [
      'claims.view',
      'payables.view',
      'payments.create',
      'payments.view',
      'payments.approve',
      'payments.succeed',
      'payments.reverse',
      'reconciliation.view',
      'reconciliation.import',
      'reconciliation.match',
      'reconciliation.unmatch',
      'accounting.view',
      'reports.view',
      'reports.export',
    ],
  },
];

const users = [
  ['admin@claims.local', 'System', 'Admin', 'ADMIN'],
  ['claims.officer@claims.local', 'Claims', 'Officer', 'CLAIMS_OFFICER'],
  ['claims.manager@claims.local', 'Claims', 'Manager', 'CLAIMS_MANAGER'],
  ['finance.officer@claims.local', 'Finance', 'Officer', 'FINANCE_OFFICER'],
  ['finance.manager@claims.local', 'Finance', 'Manager', 'FINANCE_MANAGER'],
];

const currencies = [
  ['GHS', 'Ghanaian Cedi', 'GH₵', 2],
  ['USD', 'US Dollar', '$', 2],
  ['EUR', 'Euro', '€', 2],
  ['GBP', 'Pound Sterling', '£', 2],
];

const partyNames = [
  'Ama Mensah',
  'Kwame Asare',
  'Akosua Owusu',
  'Kojo Boateng',
  'Efua Addo',
  'Yaw Ofori',
  'Abena Kusi',
  'Kofi Nyarko',
  'Adwoa Frimpong',
  'Nana Agyeman',
  'Accra Coast Logistics Ltd',
  'Volta Fresh Foods Ltd',
  'Kumasi Artisan Works Ltd',
  'Takoradi Marine Services Ltd',
  'Northern Star Trading Ltd',
  'Golden Palm Hospitality Ltd',
];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed accounts must not be created in production.');
  }
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!defaultPassword || defaultPassword.length < 8) {
    throw new Error('SEED_DEFAULT_PASSWORD must contain at least 8 characters.');
  }
  const passwordHash = await argon2.hash(defaultPassword, { type: argon2.argon2id });

  await prisma.$transaction(async (transaction) => {
    for (const [code, name, module] of permissions) {
      await transaction.permission.upsert({
        where: { code },
        create: { code, name, module },
        update: { name, module },
      });
    }

    for (const definition of roleDefinitions) {
      const role = await transaction.role.upsert({
        where: { code: definition.code },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
        },
        update: { name: definition.name, description: definition.description },
      });
      const rolePermissions = await transaction.permission.findMany({
        where: { code: { in: definition.permissions } },
        select: { id: true },
      });
      await transaction.rolePermission.deleteMany({ where: { roleId: role.id } });
      await transaction.rolePermission.createMany({
        data: rolePermissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
      });
    }

    for (const [email, firstName, lastName, roleCode] of users) {
      const existing = await transaction.user.findUnique({ where: { email } });
      const user = existing
        ? await transaction.user.update({
            where: { id: existing.id },
            data: { firstName, lastName, status: UserStatus.ACTIVE },
          })
        : await transaction.user.create({
            data: { email, firstName, lastName, passwordHash, status: UserStatus.ACTIVE },
          });
      const role = await transaction.role.findUniqueOrThrow({ where: { code: roleCode } });
      await transaction.userRole.deleteMany({ where: { userId: user.id } });
      await transaction.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }

    const admin = await transaction.user.findUniqueOrThrow({ where: { email: users[0][0] } });
    for (const [code, name, symbol, decimalPlaces] of currencies) {
      await transaction.currency.upsert({
        where: { code },
        create: { code, name, symbol, decimalPlaces },
        update: { name, symbol, decimalPlaces, isActive: true },
      });
    }
    for (const account of [
      { code: 'CLAIMS_EXPENSE', name: 'Claims Expense', accountType: 'EXPENSE' },
      { code: 'CLAIMS_PAYABLE', name: 'Claims Payable', accountType: 'LIABILITY' },
      {
        code: 'CLAIMS_OVERPAYMENT_RECEIVABLE',
        name: 'Claims Overpayment Receivable',
        accountType: 'ASSET',
      },
      { code: 'SETTLEMENT_ASSETS', name: 'Settlement Assets / Cash', accountType: 'ASSET' },
    ]) {
      await transaction.gLAccount.upsert({
        where: { code: account.code },
        create: account,
        update: { name: account.name, accountType: account.accountType, isActive: true },
      });
    }
    for (const account of [
      {
        code: 'GCB-GHS',
        name: 'GCB Bank Claims Account',
        accountType: 'BANK',
        providerName: 'GCB Bank',
        maskedIdentifier: '**** 1024',
        currencyCode: 'GHS',
      },
      {
        code: 'MTN-MOMO-GHS',
        name: 'MTN Mobile Money Claims Wallet',
        accountType: 'MOBILE_MONEY',
        providerName: 'MTN Mobile Money',
        maskedIdentifier: '+233 ** *** 4401',
        currencyCode: 'GHS',
      },
      {
        code: 'ECOBANK-USD',
        name: 'Ecobank USD Claims Account',
        accountType: 'BANK',
        providerName: 'Ecobank Ghana',
        maskedIdentifier: '**** 7782',
        currencyCode: 'USD',
      },
    ]) {
      await transaction.settlementAccount.upsert({
        where: { code: account.code },
        create: account,
        update: { ...account, status: 'ACTIVE' },
      });
    }
    const seededSettlementAccounts = await transaction.settlementAccount.findMany({
      where: { code: { in: ['GCB-GHS', 'MTN-MOMO-GHS'] } },
    });
    for (const fixture of [
      [
        '60000000-0000-4000-8000-000000000001',
        'GCB-GHS',
        'GCB-20260901-001',
        '1250.00',
        'BANK_STATEMENT',
        'Demo bank claim payment debit',
      ],
      [
        '60000000-0000-4000-8000-000000000002',
        'MTN-MOMO-GHS',
        'MOMO-20260901-001',
        '500.00',
        'MOMO_STATEMENT',
        'Demo mobile-money claim payment debit',
      ],
    ]) {
      const [id, accountCode, externalReference, amount, sourceType, description] = fixture;
      const settlementAccount = seededSettlementAccounts.find(
        (account) => account.code === accountCode,
      );
      if (!settlementAccount) throw new Error(`Missing settlement account ${accountCode}`);
      await transaction.externalTransaction.upsert({
        where: { id },
        create: {
          id,
          settlementAccountId: settlementAccount.id,
          externalReference,
          transactionDate: new Date('2026-09-01'),
          transactionType: 'DEBIT',
          amount,
          currencyCode: 'GHS',
          sourceType,
          description,
        },
        update: { description },
      });
    }
    for (const [index, displayName] of partyNames.entries()) {
      const id = `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      await transaction.party.upsert({
        where: { id },
        create: {
          id,
          partyType: index < 10 ? PartyType.PERSON : PartyType.ORGANIZATION,
          displayName,
          email: `party${index + 1}@example.test`,
          phone: `+23320000${String(index + 1).padStart(4, '0')}`,
          createdBy: admin.id,
        },
        update: { displayName, status: 'ACTIVE' },
      });
      if (index < 15) {
        const policyNumber = `POL-${String(index + 1).padStart(5, '0')}`;
        await transaction.policy.upsert({
          where: { policyNumber },
          create: {
            policyNumber,
            policyName: `${displayName} Protection Plan`,
            insuredPartyId: id,
            currencyCode: currencies[index % currencies.length][0],
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: new Date('2026-12-31'),
            createdBy: admin.id,
          },
          update: { policyName: `${displayName} Protection Plan`, status: 'ACTIVE' },
        });
      }
    }
    const [claimsOfficer, claimsManager, financeOfficer, financeManager] = await Promise.all(
      users.slice(1).map(([email]) => transaction.user.findUniqueOrThrow({ where: { email } })),
    );
    await removeLegacySampleGraph(transaction);
    await seedSampleClaims(transaction, {
      claimsOfficer,
      claimsManager,
      financeOfficer,
      financeManager,
    });
    await syncNumberSequences(transaction);
  });
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} transaction
 */
async function syncNumberSequences(transaction) {
  await transaction.$executeRaw`
    INSERT INTO claim_number_sequences (year, next_value)
    SELECT split_part(claim_number, '-', 2)::int, max(split_part(claim_number, '-', 3)::int) + 1
    FROM claims WHERE claim_number ~ '^CLM-[0-9]{4}-[0-9]+$' GROUP BY 1
    ON CONFLICT (year) DO UPDATE
    SET next_value = GREATEST(claim_number_sequences.next_value, EXCLUDED.next_value)`;
  await transaction.$executeRaw`
    INSERT INTO payment_number_sequences (year, next_value)
    SELECT split_part(payment_number, '-', 2)::int, max(split_part(payment_number, '-', 3)::int) + 1
    FROM claim_payments WHERE payment_number ~ '^PAY-[0-9]{4}-[0-9]+$' GROUP BY 1
    ON CONFLICT (year) DO UPDATE
    SET next_value = GREATEST(payment_number_sequences.next_value, EXCLUDED.next_value)`;
  await transaction.$executeRaw`
    INSERT INTO journal_number_sequences (year, next_value)
    SELECT split_part(journal_number, '-', 2)::int, max(split_part(journal_number, '-', 3)::int) + 1
    FROM journal_entries WHERE journal_number ~ '^JRN-[0-9]{4}-[0-9]+$' GROUP BY 1
    ON CONFLICT (year) DO UPDATE
    SET next_value = GREATEST(journal_number_sequences.next_value, EXCLUDED.next_value)`;
}

const sampleClaimRows = [
  ['POL-00001', 'GHS', 'Motor collision', '8500.00', 'RESERVED'],
  ['POL-00002', 'USD', 'Cargo water damage', '3200.00', 'RESERVED'],
  ['POL-00003', 'EUR', 'Equipment breakdown', '4600.00', 'RESERVED'],
  ['POL-00004', 'GBP', 'Property storm damage', '2750.00', 'RESERVED'],
  ['POL-00005', 'GHS', 'Burglary loss', '18000.00', 'RESERVED'],
  ['POL-00006', 'GHS', 'Commercial vehicle collision', '2500.00', 'PARTIAL'],
  ['POL-00007', 'GHS', 'Warehouse smoke damage', '5000.00', 'REVERSED'],
  ['POL-00008', 'USD', 'Transit damage', '900.00', 'OUTSTANDING'],
  ['POL-00009', 'EUR', 'Medical reimbursement', '700.00', 'DRAFT_PAYMENT'],
  ['POL-00010', 'GBP', 'Machinery loss', '1400.00', 'APPROVED_PAYMENT'],
  ['POL-00011', 'GHS', 'Fleet accident indemnity', '1250.00', 'PAID_BANK'],
  ['POL-00012', 'GHS', 'Retail stock loss', '500.00', 'PAID_MOMO'],
  ['POL-00013', 'GHS', 'Imported equipment damage', '1500.00', 'PAID_FX'],
  ['POL-00014', 'USD', 'Marine cargo shortage', '900.00', 'PAID_USD'],
  ['POL-00015', 'EUR', 'Travel medical indemnity', '50.00', 'PAID_EUR'],
];

async function seedSampleClaims(transaction, actors) {
  const policies = await transaction.policy.findMany({
    where: { policyNumber: { in: sampleClaimRows.map(([number]) => number) } },
    include: { insuredParty: true },
  });
  const policyByNumber = new Map(policies.map((policy) => [policy.policyNumber, policy]));
  const claims = [];
  for (const [
    index,
    [policyNumber, currencyCode, lossNature, reserveAmount, scenario],
  ] of sampleClaimRows.entries()) {
    const policy = policyByNumber.get(policyNumber);
    if (!policy) throw new Error(`Missing sample policy ${policyNumber}`);
    const claimId = sampleId('30', index + 1);
    const claim = await transaction.claim.upsert({
      where: { id: claimId },
      create: {
        id: claimId,
        claimNumber: `CLM-2026-${String(index + 1).padStart(6, '0')}`,
        policyId: policy.id,
        policyNumberSnapshot: policy.policyNumber,
        policyNameSnapshot: policy.policyName,
        insuredNameSnapshot: policy.insuredParty.displayName,
        lossDate: new Date(`2026-07-${String(index + 1).padStart(2, '0')}`),
        notificationDate: new Date(`2026-07-${String(index + 2).padStart(2, '0')}`),
        lossNature,
        description: `Fictional exercise claim ${index + 1}; not production data.`,
        currencyCode,
        createdBy: actors.claimsOfficer.id,
      },
      update: {
        policyId: policy.id,
        policyNumberSnapshot: policy.policyNumber,
        policyNameSnapshot: policy.policyName,
        insuredNameSnapshot: policy.insuredParty.displayName,
        lossDate: new Date(`2026-07-${String(index + 1).padStart(2, '0')}`),
        notificationDate: new Date(`2026-07-${String(index + 2).padStart(2, '0')}`),
        lossNature,
        description: `Fictional exercise claim ${index + 1}; not production data.`,
        currencyCode,
      },
    });
    await transaction.claimReserve.upsert({
      where: { id: sampleId('31', index + 1) },
      create: {
        id: sampleId('31', index + 1),
        claimId,
        amount: reserveAmount,
        currencyCode,
        reason: 'Initial sample reserve',
        createdBy: actors.claimsOfficer.id,
      },
      update: { amount: reserveAmount, status: 'ACTIVE' },
    });
    await transaction.claimStatusHistory.upsert({
      where: { id: sampleId('32', index + 1) },
      create: {
        id: sampleId('32', index + 1),
        claimId,
        toStatus: 'RESERVED_NOT_SETTLED',
        reason: 'Initial reserve created',
        changedBy: actors.claimsOfficer.id,
      },
      update: {},
    });
    claims.push({ ...claim, policy, scenario, reserveAmount, index });
  }
  const payables = await seedSamplePayables(transaction, actors, claims);
  const payments = await seedSamplePayments(transaction, actors, claims, payables);
  await seedSampleJournals(transaction, actors, claims, payables, payments);
  await seedSampleReconciliation(transaction, actors, payments);
  await seedSampleDocuments(transaction, actors, claims);
  await seedSampleAudit(transaction, actors, claims);
}

async function seedSamplePayables(transaction, actors, claims) {
  const payables = [];
  for (const claim of claims.filter(({ scenario }) => scenario !== 'RESERVED')) {
    const payable = await transaction.claimPayable.upsert({
      where: { id: sampleId('33', claim.index + 1) },
      create: {
        id: sampleId('33', claim.index + 1),
        claimId: claim.id,
        payeePartyId: claim.policy.insuredPartyId,
        payableType: 'INDEMNITY',
        amount: claim.reserveAmount,
        currencyCode: claim.currencyCode,
        status: 'APPROVED',
        description: 'Approved sample indemnity',
        createdBy: actors.claimsOfficer.id,
        approvedBy: actors.claimsManager.id,
        approvedAt: new Date('2026-08-20T11:00:00Z'),
      },
      update: { amount: claim.reserveAmount, status: 'APPROVED' },
    });
    await transaction.claimStatusHistory.upsert({
      where: { id: sampleId('34', claim.index + 1) },
      create: {
        id: sampleId('34', claim.index + 1),
        claimId: claim.id,
        fromStatus: 'RESERVED_NOT_SETTLED',
        toStatus: 'SETTLED_PAYMENT_OUTSTANDING',
        reason: 'Indemnity approved',
        changedBy: actors.claimsManager.id,
      },
      update: {},
    });
    payables.push({ ...payable, scenario: claim.scenario, index: claim.index });
  }
  return payables;
}

async function seedSamplePayments(transaction, actors, claims, payables) {
  const accounts = new Map(
    (await transaction.settlementAccount.findMany()).map((account) => [account.code, account]),
  );
  const plans = {
    PARTIAL: ['SUCCESSFUL', '1250.00', 'GHS', '1', '1250.00', 'GCB-GHS'],
    REVERSED: ['REVERSED', '500.00', 'GHS', '1', '500.00', 'MTN-MOMO-GHS'],
    DRAFT_PAYMENT: ['DRAFT', '350.00', 'GHS', '0.05', '17.50', 'GCB-GHS'],
    APPROVED_PAYMENT: ['APPROVED', '700.00', 'GHS', '0.08', '56.00', 'GCB-GHS'],
    PAID_BANK: ['SUCCESSFUL', '1250.00', 'GHS', '1', '1250.00', 'GCB-GHS'],
    PAID_MOMO: ['SUCCESSFUL', '500.00', 'GHS', '1', '500.00', 'MTN-MOMO-GHS'],
    PAID_FX: ['SUCCESSFUL', '100.00', 'USD', '15', '1500.00', 'ECOBANK-USD'],
    PAID_USD: ['SUCCESSFUL', '900.00', 'USD', '1', '900.00', 'ECOBANK-USD'],
    PAID_EUR: ['SUCCESSFUL', '1000.00', 'GHS', '0.05', '50.00', 'GCB-GHS'],
  };
  const payments = [];
  for (const payable of payables) {
    const plan = plans[payable.scenario];
    if (!plan) continue;
    const [status, paymentAmount, paymentCurrencyCode, fxRate, settlementAmount, accountCode] =
      plan;
    const completed = status === 'SUCCESSFUL' || status === 'REVERSED';
    const approved = status !== 'DRAFT';
    const paymentId = sampleId('35', payable.index + 1);
    const payment = await transaction.claimPayment.upsert({
      where: { id: paymentId },
      create: {
        id: paymentId,
        paymentNumber: `PAY-2026-${String(payable.index + 1).padStart(6, '0')}`,
        claimId: payable.claimId,
        payableId: payable.id,
        payeePartyId: payable.payeePartyId,
        paymentDate: new Date('2026-08-25'),
        paymentAmount,
        paymentCurrencyCode,
        fxRate,
        settlementAmount,
        settlementCurrencyCode: claims[payable.index].currencyCode,
        settlementAccountId: accounts.get(accountCode).id,
        reference: `SEED-${accountCode}-${payable.index + 1}`,
        status,
        createdBy: actors.financeOfficer.id,
        approvedBy: approved ? actors.financeManager.id : null,
        approvedAt: approved ? new Date('2026-08-25T12:00:00Z') : null,
        succeededBy: completed ? actors.financeOfficer.id : null,
        succeededAt: completed ? new Date('2026-08-26T12:00:00Z') : null,
        reversedBy: status === 'REVERSED' ? actors.financeManager.id : null,
        reversedAt: status === 'REVERSED' ? new Date('2026-08-27T10:00:00Z') : null,
        reversalReason: status === 'REVERSED' ? 'Sample reversal after payment correction' : null,
      },
      update: {
        status,
        paymentAmount,
        fxRate,
        settlementAmount,
        approvedBy: approved ? actors.financeManager.id : null,
        approvedAt: approved ? new Date('2026-08-25T12:00:00Z') : null,
        succeededBy: completed ? actors.financeOfficer.id : null,
        succeededAt: completed ? new Date('2026-08-26T12:00:00Z') : null,
        reversedBy: status === 'REVERSED' ? actors.financeManager.id : null,
        reversedAt: status === 'REVERSED' ? new Date('2026-08-27T10:00:00Z') : null,
        reversalReason: status === 'REVERSED' ? 'Sample reversal after payment correction' : null,
      },
    });
    if (status === 'SUCCESSFUL' && settlementAmount === payable.amount.toFixed(2)) {
      await transaction.claimStatusHistory.upsert({
        where: { id: sampleId('36', payable.index + 1) },
        create: {
          id: sampleId('36', payable.index + 1),
          claimId: payable.claimId,
          fromStatus: 'SETTLED_PAYMENT_OUTSTANDING',
          toStatus: 'SETTLED_AND_PAID',
          reason: 'Indemnity fully paid',
          changedBy: actors.financeOfficer.id,
        },
        update: {},
      });
    }
    payments.push({ ...payment, scenario: payable.scenario, index: payable.index, accountCode });
  }
  return payments;
}

async function seedSampleJournals(transaction, actors, claims, payables, payments) {
  const gl = new Map(
    (await transaction.gLAccount.findMany()).map((account) => [account.code, account.id]),
  );
  const plans = payables.map((payable) => ({
    sourceType: 'CLAIM_PAYABLE',
    sourceId: payable.id,
    claimId: payable.claimId,
    amount: payable.amount.toFixed(2),
    currencyCode: payable.currencyCode,
    debit: 'CLAIMS_EXPENSE',
    credit: 'CLAIMS_PAYABLE',
    actorId: actors.claimsManager.id,
  }));
  for (const payment of payments.filter(
    ({ status }) => status === 'SUCCESSFUL' || status === 'REVERSED',
  )) {
    plans.push({
      sourceType: 'CLAIM_PAYMENT',
      sourceId: payment.id,
      claimId: payment.claimId,
      amount: payment.settlementAmount.toFixed(2),
      currencyCode: claims[payment.index].currencyCode,
      debit: 'CLAIMS_PAYABLE',
      credit: 'SETTLEMENT_ASSETS',
      actorId: actors.financeOfficer.id,
    });
    if (payment.status === 'REVERSED')
      plans.push({
        sourceType: 'PAYMENT_REVERSAL',
        sourceId: payment.id,
        claimId: payment.claimId,
        amount: payment.settlementAmount.toFixed(2),
        currencyCode: claims[payment.index].currencyCode,
        debit: 'SETTLEMENT_ASSETS',
        credit: 'CLAIMS_PAYABLE',
        actorId: actors.financeManager.id,
        reversal: true,
      });
  }
  const created = [];
  for (const [index, plan] of plans.entries()) {
    const journalId = sampleId('37', index + 1);
    const original = plan.reversal
      ? created.find(
          ({ sourceType, sourceId }) =>
            sourceType === 'CLAIM_PAYMENT' && sourceId === plan.sourceId,
        )
      : null;
    const journal = await transaction.journalEntry.upsert({
      where: { id: journalId },
      create: {
        id: journalId,
        journalNumber: `JRN-2026-${String(index + 1).padStart(6, '0')}`,
        entryDate: new Date('2026-08-26'),
        sourceType: plan.sourceType,
        sourceId: plan.sourceId,
        claimId: plan.claimId,
        description: plan.reversal ? 'Sample payment reversal journal' : 'Sample event journal',
        currencyCode: plan.currencyCode,
        postedBy: plan.actorId,
        reversalOfEntryId: original?.id,
      },
      update: {
        description: plan.reversal ? 'Sample payment reversal journal' : 'Sample event journal',
      },
    });
    created.push(journal);
    const lines = [
      [plan.debit, plan.amount, '0'],
      [plan.credit, '0', plan.amount],
    ];
    for (const [lineIndex, [accountCode, debitAmount, creditAmount]] of lines.entries())
      await transaction.journalLine.upsert({
        where: { id: sampleId('38', index * 2 + lineIndex + 1) },
        create: {
          id: sampleId('38', index * 2 + lineIndex + 1),
          journalEntryId: journalId,
          glAccountId: gl.get(accountCode),
          claimId: plan.claimId,
          currencyCode: plan.currencyCode,
          debitAmount,
          creditAmount,
        },
        update: { debitAmount, creditAmount },
      });
  }
}

async function seedSampleReconciliation(transaction, actors, payments) {
  const matches = [
    ['PARTIAL', '60000000-0000-4000-8000-000000000001'],
    ['PAID_MOMO', '60000000-0000-4000-8000-000000000002'],
  ];
  for (const [index, [scenario, externalTransactionId]] of matches.entries()) {
    const payment = payments.find((item) => item.scenario === scenario);
    await transaction.reconciliationMatch.upsert({
      where: { id: sampleId('39', index + 1) },
      create: {
        id: sampleId('39', index + 1),
        paymentId: payment.id,
        externalTransactionId,
        matchedAmount: payment.paymentAmount,
        currencyCode: payment.paymentCurrencyCode,
        matchedBy: actors.financeOfficer.id,
        notes: scenario === 'PAID_MOMO' ? 'Mobile-money sample match' : 'Bank sample match',
      },
      update: { status: 'ACTIVE', matchedAmount: payment.paymentAmount },
    });
    await transaction.externalTransaction.update({
      where: { id: externalTransactionId },
      data: { reconciliationStatus: 'MATCHED' },
    });
  }
  for (const [offset, scenario] of ['REVERSED', 'PAID_FX'].entries()) {
    const payment = payments.find((item) => item.scenario === scenario);
    const externalTransactionId = sampleId('60', payment.index + 1);
    const reversed = scenario === 'REVERSED';
    await transaction.externalTransaction.upsert({
      where: { id: externalTransactionId },
      create: {
        id: externalTransactionId,
        settlementAccountId: payment.settlementAccountId,
        externalReference: `EXT-${payment.accountCode}-${payment.index + 1}`,
        transactionDate: new Date('2026-08-26'),
        transactionType: 'DEBIT',
        amount: payment.paymentAmount,
        currencyCode: payment.paymentCurrencyCode,
        sourceType: payment.accountCode === 'MTN-MOMO-GHS' ? 'MOMO_STATEMENT' : 'BANK_STATEMENT',
        description: reversed
          ? 'Reversed sample settlement evidence'
          : 'Cross-currency bank settlement evidence',
        reconciliationStatus: reversed ? 'UNMATCHED' : 'MATCHED',
      },
      update: { reconciliationStatus: reversed ? 'UNMATCHED' : 'MATCHED' },
    });
    await transaction.reconciliationMatch.upsert({
      where: { id: sampleId('39', offset + 3) },
      create: {
        id: sampleId('39', offset + 3),
        paymentId: payment.id,
        externalTransactionId,
        matchedAmount: payment.paymentAmount,
        currencyCode: payment.paymentCurrencyCode,
        status: reversed ? 'REVERSED' : 'ACTIVE',
        matchedBy: actors.financeOfficer.id,
        notes: reversed
          ? 'Historical match reversed with its payment'
          : 'USD bank evidence for a GHS claim',
        reversedBy: reversed ? actors.financeManager.id : null,
        reversedAt: reversed ? new Date('2026-08-27T10:00:00Z') : null,
        reversalReason: reversed ? 'Payment was reversed' : null,
      },
      update: { status: reversed ? 'REVERSED' : 'ACTIVE' },
    });
  }
  const momoAccount = await transaction.settlementAccount.findUniqueOrThrow({
    where: { code: 'MTN-MOMO-GHS' },
  });
  await transaction.externalTransaction.upsert({
    where: { id: sampleId('60', 99) },
    create: {
      id: sampleId('60', 99),
      settlementAccountId: momoAccount.id,
      externalReference: 'MOMO-UNMATCHED-EXAMPLE',
      transactionDate: new Date('2026-08-28'),
      transactionType: 'DEBIT',
      amount: '275.00',
      currencyCode: 'GHS',
      sourceType: 'MOMO_STATEMENT',
      description: 'Unmatched mobile-money sample transaction',
    },
    update: { reconciliationStatus: 'UNMATCHED' },
  });
}

async function seedSampleDocuments(transaction, actors, claims) {
  const uploadRoot = path.resolve(process.cwd(), 'uploads');
  await mkdir(uploadRoot, { recursive: true });
  const types = [
    'CLAIM_FORM',
    'POLICE_REPORT',
    'LOSS_PHOTO',
    'ESTIMATE',
    'ADJUSTER_REPORT',
    'PAYMENT_PROOF',
  ];
  for (const [index, documentType] of types.entries()) {
    const id = sampleId('40', index + 1);
    const storageKey = `${id}.pdf`;
    const content = Buffer.from(
      `%PDF-1.4\n% Fictional sample claim document ${index + 1}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
    );
    await writeFile(path.join(uploadRoot, storageKey), content, { flag: 'w' });
    await transaction.claimDocument.upsert({
      where: { id },
      create: {
        id,
        claimId: claims[index * 2].id,
        documentType,
        originalFileName: `sample-${documentType.toLowerCase().replaceAll('_', '-')}.pdf`,
        storageProvider: 'LOCAL',
        storageKey,
        mimeType: 'application/pdf',
        fileSizeBytes: content.length,
        description: 'Fictional sample document',
        uploadedBy: actors.claimsOfficer.id,
      },
      update: {
        claimId: claims[index * 2].id,
        documentType,
        originalFileName: `sample-${documentType.toLowerCase().replaceAll('_', '-')}.pdf`,
        storageProvider: 'LOCAL',
        storageKey,
        mimeType: 'application/pdf',
        fileSizeBytes: content.length,
        status: 'ACTIVE',
        description: 'Fictional sample document',
      },
    });
  }
}

async function seedSampleAudit(transaction, actors, claims) {
  for (const [index, claim] of claims.slice(0, 5).entries())
    await transaction.auditLog.upsert({
      where: { id: sampleId('50', index + 1) },
      create: {
        id: sampleId('50', index + 1),
        actorUserId: actors.claimsOfficer.id,
        action: 'CLAIM_CREATED',
        entityType: 'CLAIM',
        entityId: claim.id,
        claimId: claim.id,
        newValues: { claimNumber: claim.claimNumber, currencyCode: claim.currencyCode },
        correlationId: `seed-claim-${index + 1}`,
      },
      update: { claimId: claim.id },
    });
}

function sampleId(prefix, value) {
  return `${prefix}000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
}

async function removeLegacySampleGraph(transaction) {
  const legacyPaymentIds = [sampleId('35', 1), sampleId('35', 2)];
  const legacyPayableIds = [sampleId('33', 1), sampleId('33', 2), sampleId('33', 3)];
  const legacyJournalIds = Array.from({ length: 5 }, (_, index) => sampleId('37', index + 1));
  await transaction.reconciliationMatch.deleteMany({
    where: { id: { in: [sampleId('39', 1), sampleId('39', 2)] } },
  });
  await transaction.journalLine.deleteMany({ where: { journalEntryId: { in: legacyJournalIds } } });
  await transaction.journalEntry.deleteMany({ where: { id: { in: legacyJournalIds } } });
  await transaction.claimPayment.deleteMany({ where: { id: { in: legacyPaymentIds } } });
  await transaction.claimPayable.deleteMany({ where: { id: { in: legacyPayableIds } } });
  await transaction.claimStatusHistory.deleteMany({
    where: {
      id: {
        in: [sampleId('34', 1), sampleId('34', 2), sampleId('34', 3), sampleId('36', 1)],
      },
    },
  });
}

seed()
  .then(() => process.stdout.write('Identity, reference, and demonstration seed completed.\n'))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
