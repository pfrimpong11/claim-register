# Implementation Plan

These phases are an execution order for one time-boxed exercise, not separate product releases. Each phase ends in a runnable, tested increment, and the final submission documents deliberate simplifications and what would be done differently with more time.

## Phase 0 — Repository foundation

**Deliverables**

- Separate `client/` and `server/` packages with root convenience scripts; no cross-importing application source between them.
- TypeScript-capable Next.js client; modern JavaScript ES-module server with `// @ts-check`/JSDoc where useful, formatting, linting, test runners, and CI.
- Modular Express foundation with shared error handling, Zod validation, authentication/authorization middleware, security headers, Pino logging/redaction, and OpenAPI generation.
- Worker implementation under `server/src/worker`, embedded server startup, standalone worker startup, shared processor registration, readiness, and graceful shutdown.
- Native local-development scripts and `.env.example`; Dockerfiles/Compose are retained for deployment packaging, not local development.
- Structured logging, environment validation, correlation IDs, and basic health endpoints.

**Exit criteria**

- After locally installed PostgreSQL and Redis are configured, one root command starts client and server without Docker; the server starts its worker automatically. Cloudinary credentials are optional because local storage is the fallback.
- A documented server command starts the worker alone, and an environment flag disables the embedded worker for detached deployments.
- CI installs from lockfile and runs format/lint/type/test/build checks.
- API readiness fails when required infrastructure is unavailable.

## Phase 1 — Database, identity, and access

**Deliverables**

- Initial Prisma schema/migration for identity, RBAC, currencies, parties, policies, and audit logs.
- Deterministic seed command with roles, permissions, users, currencies, parties, and policies.
- Secure login/logout/me session flow and API permission guards.
- Basic frontend shell and authenticated navigation.

**Exit criteria**

- Each seeded role sees only permitted actions.
- Disabled accounts and unauthorized API calls are rejected.
- Authentication actions are auditable without exposing secrets.

## Phase 2 — Claims register vertical slice

**Deliverables**

- Claims, initial indemnity reserves, and status-history migrations.
- Create claim workflow with searchable policy selection.
- Minimal inline party and policy modals.
- Lightweight claim document upload/list/view/download/deactivate flow behind a storage interface: authenticated/private Cloudinary when configured, otherwise protected `server/uploads/`. Include validation, limits, path-traversal tests, authorized delivery, and compensating cleanup for both adapters.
- Register/detail pages with server-side filters, sort, pagination, URL state, and per-currency summaries.
- Seed claims representing realistic dates, currencies, early financial states, and a few safe document metadata fixtures.

**Exit criteria**

- A Claims Officer can create and retrieve a claim.
- The initial estimated loss is represented by an active indemnity reserve.
- An authorized user can upload and retrieve a validated document from the claim detail page.
- Register totals match the active filters and never combine currencies.

## Phase 3 — Indemnity payables

**Deliverables**

- Payable schema and create/approve/cancel transitions.
- Claims Manager approval UI and audit trail.
- Derived approved amount and pre-payment financial statuses.
- Seeded Claims Expense, Claims Payable, and Settlement Assets GL accounts.
- Automatic balanced payable-approval journal created in the same database transaction.
- Unit/integration tests for transition rules and authorization.

**Exit criteria**

- Only approved indemnity contributes to approved amount.
- Seed data contains no non-indemnity payables.
- Invalid/repeated transitions return stable conflict errors.
- Authorized users may approve regardless of who created the record; maker-checker is documented as a with-more-time improvement.
- Every approved indemnity has exactly one balanced, source-linked approval journal.

## Phase 4 — Payments and FX

**Deliverables**

- Settlement accounts, payments, reversals, and idempotency schema.
- Partial payment and cross-currency forms with settlement preview.
- Backend decimal/rounding policy and transactional overpayment protection.
- Derived paid, outstanding, and financial status in register/detail/summary.
- Automatic successful-payment and reversal journals, posted atomically with their source events.
- Read-only accounting journal list/detail screens protected by `accounting.view`.
- Concurrency and idempotency tests.

**Exit criteria**

- Same- and cross-currency examples reconcile mathematically from stored facts.
- Two concurrent requests cannot overpay a payable.
- Full successful indemnity payment yields `SETTLED_AND_PAID`; reversal restores outstanding.
- Journals balance in claim currency and posted history is corrected only through linked reversal journals.

## Phase 5 — Reconciliation

**Deliverables**

- External transaction/import/match schema.
- Seeded bank and mobile-money accounts and transactions.
- Validated CSV import as a background job with row-level error reporting.
- Unmatched views and manual match/unmatch UI.
- Atomic partial/full match limits and separate payment/reconciliation display.

**Exit criteria**

- A successful payment can visibly remain unmatched.
- A mobile-money transaction can be matched without bank-specific logic.
- Neither side can be overmatched, including concurrent requests.

## Phase 6 — Reporting, export, and hardening

**Deliverables**

- Filter-consistent CSV export via worker for large results.
- Audit viewer with permission checks and masked sensitive data.
- Accessibility pass; Helmet/CSP, CORS, CSRF, proxy, request-limit/timeout, parameter-pollution, injection, upload, Redis rate-limit, and authorization verification; performance indexes; dependency/secret scanning; and observability/incident runbooks.
- Production edge-protection guidance and a load/abuse test confirming graceful `429`/`503` behavior and bounded queue/database usage.
- Complete critical Playwright journey and migration/backup-restore rehearsal.

**Exit criteria**

- The acceptance journey in `REQUIREMENTS.md` passes end to end.
- Fresh install, migration, seed, backup, and restore are documented and tested.
- No critical/high security or accessibility defects remain.

## Final submission — Assumptions and “with more time”

The README must explain why the exercise uses lightweight structures and identify these production enhancements without implementing them:

- Reserve movement ledger and assessment/excess workflow.
- Additional payable types and allocation of one payment across payables.
- Automated match suggestions/provider integrations.
- Advanced document versioning/OCR/mandatory-document workflows, recoveries, reinsurance, and richer party/policy administration.
- Maker-checker separation, approval chains, and monetary authority limits.
- Functional/base-currency ledgers, FX gains/losses, revaluation, configurable posting rules, periods/close controls, and IFRS 17 integration.

## Recommended work order inside each phase

1. Confirm requirements and invariants.
2. Add migration and repository behavior.
3. Implement domain/application service and API contract.
4. Add frontend flow.
5. Add unit, integration, and end-to-end coverage.
6. Verify migrations, permissions, audit events, failure states, and documentation.

## Definition of done

- Acceptance criteria are demonstrably met.
- Relevant automated checks pass.
- Database changes have forward migrations and safe rollback/roll-forward notes.
- Authorization, validation, audit, idempotency, and concurrency were considered.
- Documentation and OpenAPI reflect behavior.
- No secrets, production PII, or undocumented manual setup are committed.
