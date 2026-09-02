import argon2 from 'argon2';
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
      { code: 'SETTLEMENT_ASSETS', name: 'Settlement Assets / Cash', accountType: 'ASSET' },
    ]) {
      await transaction.gLAccount.upsert({
        where: { code: account.code },
        create: account,
        update: { name: account.name, accountType: account.accountType, isActive: true },
      });
    }
    const seededSettlementAccounts = await transaction.settlementAccount.findMany({
      where: { code: { in: ['GCB-GHS', 'MTN-MOMO-GHS'] } },
    });
    for (const fixture of [
      {
        id: '60000000-0000-4000-8000-000000000001',
        accountCode: 'GCB-GHS',
        externalReference: 'GCB-DEMO-20260901-001',
        transactionDate: new Date('2026-09-01'),
        amount: '1250.00',
        sourceType: 'BANK_STATEMENT',
        description: 'Demo bank claim payment debit',
      },
      {
        id: '60000000-0000-4000-8000-000000000002',
        accountCode: 'MTN-MOMO-GHS',
        externalReference: 'MOMO-DEMO-20260901-001',
        transactionDate: new Date('2026-09-01'),
        amount: '500.00',
        sourceType: 'MOMO_STATEMENT',
        description: 'Demo mobile-money claim payment debit',
      },
    ]) {
      const settlementAccount = seededSettlementAccounts.find(
        (account) => account.code === fixture.accountCode,
      );
      if (!settlementAccount) throw new Error(`Missing settlement account ${fixture.accountCode}`);
      await transaction.externalTransaction.upsert({
        where: { id: fixture.id },
        create: {
          id: fixture.id,
          settlementAccountId: settlementAccount.id,
          externalReference: fixture.externalReference,
          transactionDate: fixture.transactionDate,
          transactionType: 'DEBIT',
          amount: fixture.amount,
          currencyCode: 'GHS',
          sourceType: fixture.sourceType,
          description: fixture.description,
        },
        update: { description: fixture.description },
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
  });
}

seed()
  .then(() => process.stdout.write('Identity, RBAC, and reference seed completed.\n'))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
