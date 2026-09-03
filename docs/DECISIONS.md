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

Physical deletion after deactivation is asynchronous and retryable. PostgreSQL records pending/completed cleanup and failed attempts; BullMQ performs deletion, and startup recovery re-enqueues pending work so Redis is not the system of record.

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

## ADR-021: Approved payables are not cancelled in place

**Decision:** A payable can be cancelled only while it is in `DRAFT`. Approval makes the payable and its source-linked journal immutable for the exercise.

**Why:** Cancelling an approved financial obligation without an equal reversal would corrupt the audit and ledger history. A production implementation would add an explicit reasoned reversal event and reversing journal rather than mutating the approved record.

## ADR-022: Payment reversal retains the original settlement facts

**Decision:** Reversal changes a successful payment to `REVERSED`, records the reversal actor, time, and reason, and creates a new journal linked to the original payment journal. It does not delete the payment, alter its amount/FX facts, or create a negative payment row.

**Why:** This is the smallest auditable reversal model for the exercise. The original execution remains reproducible, paid totals exclude the reversed status, and the ledger is corrected append-only through the linked reversing journal.

## ADR-023: Durable row-tolerant reconciliation imports

**Decision:** CSV uploads create a PostgreSQL import record before a bounded BullMQ job processes them. Rows are validated independently; valid unique rows are retained while duplicates and malformed rows are counted and reported. Temporary CSV inputs live only under the protected server uploads tree and are removed after completed processing. Pending/processing imports are re-enqueued on startup.

**Why:** A statement can contain one bad or repeated row without losing all valid settlement evidence. PostgreSQL remains the source of truth while the shared embedded/detachable worker keeps request latency bounded and supports recovery after Redis or process interruption.

## ADR-024: Reconciliation matches are partial, atomic, and reversible

**Decision:** Manual matches use the payment's original payment currency and settlement account, require an external debit, and may cover a partial amount. Serializable transactions lock both sides and reject overmatching. Unmatch retains the original match as `REVERSED`; payment execution status is never changed by reconciliation.

**Why:** This supports bank and mobile-money evidence without provider-specific rules, preserves history, and keeps execution confirmation independent from reconciliation evidence as required by the exercise.

## ADR-025: Claims exports always use the bounded worker path

**Decision:** Every CSV export is represented by a durable PostgreSQL record and processed by BullMQ in pages through the canonical claims service. Generated files use randomized server identifiers under the protected uploads tree, expire after 24 hours, and are delivered only through an authorized API. CSV cells are quoted and formula-prefixed values are neutralized.

**Why:** One path avoids different filter or financial definitions between small and large exports, bounds API request work, supports detached workers and retries, and prevents spreadsheet injection or direct file exposure.

## ADR-026: Exercise observability is bounded and provider-neutral

**Decision:** Expose process-local, non-sensitive HTTP and memory counters alongside readiness, retain structured correlation-aware API/worker logs, and document the production alerting and trusted-scrape boundary. Do not add a hosted telemetry vendor to the exercise.

**Why:** The exercise demonstrates useful operating signals without coupling the application to an unselected vendor. Production would aggregate per-instance metrics and logs through managed monitoring, tracing, dashboards, and alerts.

## ADR-027: Demonstration records use an explicit namespace

**Decision:** Seed 15 idempotent `DEMO`-numbered fictional claims without advancing or resetting normal claim, payment, or journal sequences. The sample covers the exercise statuses, currencies, payment lifecycle/FX, documents, journals, and reconciliation; seeded payables remain indemnity-only.

**Why:** Evaluators can immediately inspect all statuses, currencies, documents, journals, and settlement sources, while later user-created records retain safe monotonic numbering and remain distinguishable from fixtures.
