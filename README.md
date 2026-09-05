# Mini Claims Register

A small web application for registering insurance claims and recording the payments made against them.

- Repository: [github.com/pfrimpong11/claim-register](https://github.com/pfrimpong11/claim-register)
- Live application: [https://claims.princefrimpong.com](https://claims.princefrimpong.com)

## Run locally

### Prerequisites

- Node.js 22 or newer and npm 10 or newer
- PostgreSQL
- Redis
- Cloudinary credentials are optional; without them, claim documents use the protected local `server/uploads/` directory

### Setup

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create `server/.env` from `server/.env.example` and update `DATABASE_URL`, `REDIS_URL`, and the other local values. Set `SEED_DEFAULT_PASSWORD` to a development-only password of at least 16 characters.

3. Create `client/.env.local` from `client/.env.example` if the API is not running at the default `http://localhost:4000/api/v1` address.

4. Create the PostgreSQL database, ensure PostgreSQL and Redis are running, then prepare and seed the database:

   ```bash
   npm run db:generate --prefix server
   npm run db:deploy --prefix server
   npm run db:seed --prefix server
   ```

5. Start the frontend, API, and embedded background worker:

   ```bash
   npm run dev
   ```

The client runs at `http://localhost:3000` and the API at `http://localhost:4000`. The seed creates 15 fictional claims and five role-based users under `@claims.local`, including `admin@claims.local`; all use the password supplied through `SEED_DEFAULT_PASSWORD`. Docker is not required for local development.

Run the complete local quality suite with:

```bash
npm run verify
```

## Assumptions and decisions

- **Policies and insured parties are references, not free text.** A claim must relate to a policy and an insured party. Although full policy and party administration is outside this exercise, seeded records and small point-of-need forms make the register usable without creating inconsistent names and policy numbers. Selecting a policy during claim registration supplies the insured party, currency, and policy details, which are also snapshotted on the claim for historical accuracy.

- **The estimated loss is the initial indemnity reserve, not the approved amount.** Registering a claim creates its first reserve from the estimated loss. The approved amount is the sum of approved indemnity payables. This separates the current estimate of the loss from the amount the insurer has agreed to pay.

- **The exercise settles indemnity only.** The data model can support additional payable types, but the demonstration seed uses only `INDEMNITY` payables to the insured party. A payable is created as a draft and must be approved before payments can settle it.

- **Claim status is derived rather than selected manually.** No approved indemnity produces `Reserved, not yet settled`; an approved indemnity with a positive balance produces `Settled, payment outstanding`; and a zero or negative balance produces `Settled and paid`.

- **Money and FX calculations are reproducible.** Monetary values use PostgreSQL `numeric` and decimal arithmetic. A payment may use a different currency from the claim. The stored FX rate means one unit of payment currency in claim currency, and the claim-currency settlement value is stored with the payment. Current exchange rates are never used to recalculate historical payments.

- **The financial figures follow explicit definitions.** `Balance = approved indemnity - successful, non-reversed payments in claim currency`. Outstanding is the positive part of that balance; a negative balance is displayed separately as an overpayment. A genuine external overpayment can be recorded only with explicit confirmation and a reason. Register totals respect the active filters and remain grouped by claim currency rather than adding unlike currencies together.

- **Payment recording and reconciliation answer different questions.** Transfers happen outside this application. A successful payment affects the claim immediately, while reconciliation independently matches that record to an imported transaction from the same settlement account and currency. Bank and mobile-money accounts use the same model. This provides evidence of the external transfer and helps expose discrepancies without making reconciliation determine claim status.

- **Documents provide lightweight claim evidence.** Claim forms, reports, photographs, invoices, and similar files can be classified, described, viewed, downloaded, and deactivated. Cloudinary is used when configured; otherwise protected local storage is used. OCR, document versioning, and document approval workflows are intentionally excluded.

- **Accounting and access control are deliberately lightweight.** Approving payables, completing payments, recording confirmed overpayments, and reversing payments generate balanced journal entries automatically. Users do not post journals manually. Role-based permissions protect server actions, but maker-checker separation and monetary authority limits are not enforced in this exercise.

The application is a modular monolith: Next.js 16 and React 19 in `client/`; Node.js, Express, and modern JavaScript in `server/`; PostgreSQL and Prisma for durable data; and Redis/BullMQ for background work. This keeps the exercise manageable while leaving clear module boundaries for future expansion.

## With more time

I would add:

- A richer claim lifecycle with adjuster assignment, reserve movement history, reserve approvals, assessment, closure, and reopening controls.
- Additional payable types such as legal, medical, repair, and adjuster fees, together with allocation of one payment across multiple payables.
- Recoveries, salvage, subrogation, reinsurance, and related financial workflows.
- Maker-checker separation, approval chains, segregation of duties, and monetary authority limits.
- Full policy, party, and premium domains, including policy coverage, limits, endorsements, effective periods, and lifecycle validation.
- Functional-currency accounting, controlled FX-rate sources, exchange gains and losses, revaluation, accounting periods, finance-system integration, and fuller insurance-accounting treatment.
- Automated reconciliation suggestions, many-to-many matching, and direct integrations with bank, mobile-money, and payment-provider APIs.
- Stronger document controls such as malware scanning, versioning, retention policies, previews, OCR, and assisted document analysis.
- Production-scale operational work including a managed WAF/CDN, autoscaling, deeper observability, disaster-recovery automation, penetration testing, and formal threat modelling.

## Further documentation

Detailed [requirements](docs/REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md), [data model](docs/DATA_MODEL.md), [API contract](docs/API_CONTRACT.md), [decision log](docs/DECISIONS.md), and [local-development notes](docs/LOCAL_DEVELOPMENT.md) are available in `docs/`.
