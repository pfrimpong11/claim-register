# Architecture Decision Log

## ADR-001: Modular monolith

**Decision:** Keep the Next.js frontend in `client/` and the domain-oriented Node.js backend in `server/`. Worker code stays inside the server and runs embedded by default, with a standalone entry point for independent deployment.

**Why:** The scope benefits from atomic PostgreSQL transactions and clear modules, but not from distributed-system complexity.

## ADR-002: Modular Express backend

**Decision:** Use Node.js with Express and modern JavaScript ES modules, not TypeScript. Organize the API into domain modules with routers, thin controllers, application services, repositories, runtime validation schemas, and tests.

**Why:** Express and JavaScript are the selected backend technologies. Explicit module boundaries preserve maintainability without requiring a framework-managed module system. Runtime validation, JSDoc, and optional `// @ts-check` provide safety while domain and transaction logic remains independent from HTTP handlers.

Zod is the standard runtime validation library and Pino is the standard structured logger for the server.

## ADR-003: Prisma and PostgreSQL migrations

**Decision:** Use Prisma for typed data access and committed, forward-only migration history against PostgreSQL. Once a migration has been applied to any shared environment, its directory and SQL are immutable. Corrections are delivered as new migrations; applied migrations are never rewritten, reordered, or deleted.

**Why:** It provides generated JavaScript client access and migration tooling while retaining direct SQL migrations for constraints, indexes, locking queries, and advanced PostgreSQL behavior. Immutable history keeps migration checksums and environments consistent and makes remediation auditable. Production deployment uses `migrate deploy`, never schema push or automatic destructive rollback. Disaster recovery may restore a verified backup, and a failed migration may be administratively resolved only after investigation; neither mechanism changes committed migration history.

## ADR-004: Redis is not authoritative

**Decision:** Use Redis for BullMQ, rate limiting, sessions/caches where chosen, and coordination only.

**Why:** Financial truth and concurrency invariants must remain durable in PostgreSQL.

## ADR-005: Policies and parties use hybrid reference data

**Decision:** Seed useful records and permit minimal point-of-need creation, without standalone CRUD modules.

**Why:** The evaluator can enter real-looking data without expanding the project into policy/customer administration.

## ADR-006: Premiums are out of scope

**Decision:** Claims reference policies but do not store premium collection transactions.

**Why:** Premium billing is a separate domain and is not required by the mini claims register.

## ADR-007: Payables separate approval from payment

**Decision:** Approved amounts live in payables; cash movements live in payments.

**Why:** A claim may be approved before payment and may be paid in installments. This preserves the distinction among estimate, obligation, and cash movement.

For this exercise, permissions authorize approval actions. Maker-checker separation, approval chains, and monetary authority limits are improvements we would make with more time, not requirements of this implementation.

## ADR-008: Indemnity determines mini-register settlement

**Decision:** Financial status and core register calculations use indemnity payables/payments. Seed only indemnity payables.

**Why:** The agreed business interpretation is that the claim is paid when its indemnity is paid. The schema retains future expense payable types without complicating the demonstration.

## ADR-009: Generic reconciliation model

**Decision:** Model settlement accounts and external transactions rather than bank-specific statements.

**Why:** Ghanaian payments commonly use mobile money as well as banks. Reconciliation should be source-neutral.

## ADR-010: Payment and reconciliation statuses are independent

**Decision:** A successful application payment can remain unmatched.

**Why:** Execution confirmation and independent provider evidence answer different questions.

## ADR-011: Stored FX facts

**Decision:** Persist payment amount/currency, canonical FX rate, and claim-currency settlement amount.

**Why:** Historical calculations must remain reproducible and must not depend on today's rate.

## ADR-012: Derived balances and status

**Decision:** Derive approved, paid, outstanding, and financial status from transactional records.

**Why:** Duplicated mutable balances drift. A measured read model may later optimize the same definitions.

## ADR-013: Financial correction by reversal

**Decision:** Successful financial records are reversed and replaced, not silently edited or deleted.

**Why:** Auditability is required for claims and finance workflows.

## ADR-014: Lightweight claim documents are included

**Decision:** Include document upload, classification, optional description, authorized view/download, and deactivation on the claim detail page.

**Why:** Documents are central to real claims handling and were explicitly retained for the mini register. Complex versioning, OCR, approvals, and mandatory-document rules remain out of scope. A storage interface uses authenticated/private Cloudinary delivery when configured and a protected `server/uploads/` adapter when Cloudinary is absent. Partial cloud configuration fails startup rather than silently changing provider.

## ADR-015: Local development does not use Docker

**Decision:** Run Next.js, Express with its embedded worker, PostgreSQL, and Redis through host-installed/local services during development. Retain Docker/Compose only for deployment packaging and production-like validation.

**Why:** This matches the chosen development workflow and prevents container tooling from becoming a prerequisite for ordinary development or tests.

## ADR-016: Explicit database transaction boundaries

**Decision:** Multi-record financial and reconciliation operations use PostgreSQL transactions through Prisma, with serializable retry or row locking where aggregate limits can race.

**Why:** Claim/reserve creation, approvals, payment limits, reversals, and reconciliation must never leave partial or concurrently invalid state.

## ADR-017: Embedded but detachable worker

**Decision:** Server startup launches the HTTP API and BullMQ worker by default. The worker implementation also has a worker-only entry point, and API replicas can disable the embedded worker through validated configuration.

**Why:** Local operation stays simple while production can isolate and scale background work independently without duplicating code.

## ADR-018: Layered server security and DDoS posture

**Decision:** Use strict runtime validation, Helmet/CSP, explicit CORS, secure sessions/CSRF, Redis-backed rate limits, request limits/timeouts, safe proxy configuration, parameterized database access, upload controls, structured security logging, and least privilege. Place production behind a CDN/reverse proxy/WAF for volumetric DDoS protection.

**Why:** Application middleware mitigates abuse but cannot replace network-edge protection. Layered controls address injection, XSS, CSRF, credential attacks, malicious uploads, resource exhaustion, and operational response.

## ADR-019: Exercise-defined claim statuses only

**Decision:** Derive and display only `RESERVED_NOT_SETTLED`, `SETTLED_PAYMENT_OUTSTANDING`, and `SETTLED_AND_PAID` from approved indemnity and successful settlement amounts.

**Why:** These are the statuses required by the exercise and match the agreed meaning that an indemnity is settled when approved and paid when its outstanding indemnity reaches zero. A richer operational workflow would be added with more time rather than mixed into the exercise status.

## ADR-020: Lightweight general ledger is in scope

**Decision:** Include seeded GL accounts and automatic balanced journals for indemnity approval, successful payment, and payment reversal. Journals are read-only to users and post atomically with their source events.

**Why:** The lightweight GL demonstrates the relationship between claims operations and accounting without building a general accounting platform. It balances in claim currency using stored settlement equivalents. Functional currency, revaluation, FX gain/loss, configurable posting rules, periods, and IFRS 17 are documented as improvements with more time.

## What we would do with more time

- Cloud hosting provider and production secret manager.
- External identity provider versus local credentials beyond the exercise.
- Real payment-provider integrations.
- Full functional/base-currency accounting, FX gain/loss and revaluation, configurable posting rules, accounting periods, close controls, and IFRS 17 integration.
- Maker-checker separation, approval chains, and currency-specific monetary authority limits.
- Reserve movements, assessments/excess workflow, advanced document workflow/OCR/versioning, recoveries/reinsurance, richer party/policy administration, payment allocations, and automated reconciliation/provider integrations.
