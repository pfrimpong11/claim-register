# Architecture

## 1. System shape

Use a modular monolith with physically separate frontend and backend folders. The worker belongs to the backend codebase. By default the server process starts both the HTTP API and BullMQ worker; the same worker can be launched alone for independent scaling or failure isolation.

```text
Browser
  |
  v
Next.js client (React 19)
  |
  v
Node.js Express server (JavaScript)
  |--------------------|
  v                    v
PostgreSQL             Redis
system of record       cache, queues, rate limits
                       |
                       v
                    BullMQ worker
                    (embedded by default,
                     detachable entry point)
```

## 2. Applications

### `client`

- Next.js 16 App Router and React 19.
- Server Components by default; Client Components only for interactive forms/tables.
- URL-driven register filters and pagination.
- A typed API client generated from or validated against shared contracts.
- No authoritative financial calculations in the browser.

### `server`

- Express application composed from domain modules; the root app handles shared middleware and mounts module routers.
- Backend source is modern JavaScript with ES modules. Runtime schemas provide boundary safety; `// @ts-check` and JSDoc may provide editor/static assistance without converting the backend to TypeScript.
- REST API under `/api/v1` with OpenAPI documentation.
- Modules: auth, access, parties, policies, claims, documents, reserves, payables, payments, settlement-accounts, reconciliation, accounting, reports, audit, health.
- Application services own use cases and transaction boundaries.
- Domain policies own calculations and legal state transitions.
- Prisma repositories isolate persistence details from domain/application code.

Each module follows this shape:

```text
modules/<module>/
  <module>.routes.js       Express router and route composition
  <module>.controller.js   HTTP translation only
  <module>.service.js      use cases and transaction boundaries
  <module>.repository.js   Prisma persistence
  <module>.schemas.js      runtime request/response validation
  __tests__/
```

Shared Express error handling, authentication, authorization, request IDs, Zod validation, rate limiting, and security headers live under `src/middleware` or `src/shared`. Async errors are forwarded to the centralized error handler. Controllers never call Prisma directly. Pino provides JSON logging and request logging with correlation IDs and configured redaction paths.

### `server/src/worker`

- BullMQ consumers for CSV import, export generation, Cloudinary cleanup, and optional asynchronous audit/report tasks.
- Jobs are idempotent, retryable, observable, and reference durable PostgreSQL records.
- Redis queue state is not treated as permanent business truth.
- `server/src/index.js` starts the API and worker together by default. Startup is coordinated, but each component owns its shutdown hook and health state.
- `server/src/worker/standalone.js` starts only the worker using the exact same registration/processor modules. Production may set `START_EMBEDDED_WORKER=false` on API replicas and scale the standalone worker separately.
- A worker startup failure must make combined startup fail or readiness remain false; the API must not silently claim a healthy combined runtime.

## 3. Data ownership

PostgreSQL is authoritative for users, reference data, claims, financial records, reconciliation, and audits. Redis may cache safe read models and coordinate rate limits/queues/short-lived locks. A Redis flush must not corrupt or erase a business transaction.

## 4. Module boundaries

```text
Identity & Access
  users, roles, permissions, sessions

Reference Data
  currencies, parties, policies, settlement accounts

Claims
  claims, documents, reserves, status history

Payables & Payments
  payables, payments, payment allocations/reversals

Reconciliation
  external transactions, matches, imports

Accounting
  GL accounts, event-generated journals, read-only journal views

Reporting
  register query, currency summaries, exports

Governance
  audit log, health, observability
```

Modules communicate through application interfaces and in-process domain events inside the monolith. Do not introduce a message broker or microservices for this exercise.

## 5. Critical transaction: successful payment

Within one database transaction:

1. Authorize the action and resolve the idempotency key.
2. Lock the payable or use serializable conflict protection.
3. Confirm the payable is approved and payment fields are consistent.
4. Sum successful, non-reversed settlement amounts.
5. Reject if the new settlement amount exceeds outstanding.
6. Persist the payment/status change and audit record.
7. Commit, then publish any non-critical cache invalidation/job notification.

The database transaction—not Redis—is the concurrency boundary.

## 6. Transaction boundaries

Use a Prisma interactive transaction when a use case must read/validate and write several related records atomically. Use a transaction-scoped repository/client throughout the operation. Where aggregate limits can race, use serializable isolation with retry or explicit row locking through reviewed SQL.

Required atomic workflows include:

- Claim creation, generated number, initial indemnity reserve, status history, and audit record.
- Payable approval/cancellation and audit record.
- Payment success, idempotency resolution, outstanding recheck, state transition, and audit record.
- Payment reversal and restoration of the derived outstanding position.
- External transaction import row bookkeeping where partial persistence would misstate import status.
- Reconciliation match/unmatch, unmatched-balance checks, both sides' status updates, and audit record.
- Indemnity payable approval plus its Claims Expense/Claims Payable journal and audit record.
- Successful payment or reversal plus its linked Claims Payable/Settlement Assets journal and audit record.

File storage operations cannot participate in a PostgreSQL transaction. Document upload therefore uses a compensating workflow: validate the buffered/streamed upload, write it through the selected adapter with a randomized identifier, persist metadata, and delete the stored object if metadata persistence fails. Deactivation is committed and audited before a retryable cleanup job removes the object, if physical deletion is enabled.

## 7. Claim-document storage

Expose storage through a `DocumentStorage` interface with `put`, `getDownload`, and `delete` operations. Select exactly one adapter during validated server startup:

- `CloudinaryDocumentStorage` when all required Cloudinary credentials are present. Use authenticated/private delivery. The API authorizes access and returns a short-lived signed URL or streams the asset. Validate webhook signatures if notifications are enabled.
- `LocalDocumentStorage` when Cloudinary is not configured. Its root is `server/uploads/` by default and may be overridden only with a validated server-side path. It writes randomized names, prevents path traversal, never uses the original filename as a path, and streams downloads through the authorized API with safe content headers.

Partial Cloudinary configuration is a startup error; it must not silently fall back locally because that can hide a deployment misconfiguration. An entirely absent Cloudinary configuration selects local storage and logs the selected provider without logging secrets.

PostgreSQL stores `storage_provider`, a provider-neutral `storage_key`, and optional provider metadata. For Cloudinary this includes `asset_id`, `public_id`, `version`, `resource_type`, and `format`. For local storage, the key is a generated relative identifier resolved strictly beneath the configured upload root. The local directory is not mounted by Express static middleware and its contents are excluded from Git, Docker build contexts where appropriate, logs, and frontend bundles.

## 8. Money and FX

- PostgreSQL: `numeric(20,4)` for monetary amounts and `numeric(20,8)` for FX rates.
- API JSON: decimal strings, for example `{ "amount": "1000.00", "currency": "GHS" }`.
- Application: a decimal arithmetic library.
- FX convention: `settlement_amount = payment_amount * fx_rate`, where one payment-currency unit equals `fx_rate` claim-currency units.
- Explicitly define rounding per currency; default to ISO decimal places with half-up rounding at the settlement boundary.

## 9. Authentication and security

- Hash passwords with Argon2id.
- Prefer opaque server-side sessions stored in PostgreSQL or Redis with durable revocation strategy; expose them through secure, HTTP-only, same-site cookies.
- Protect state-changing cookie-authenticated endpoints against CSRF.
- Apply permission guards in the API and mirror capabilities in the UI for usability.
- Validate request bodies, query strings, imports, and environment configuration.
- Rate-limit login and sensitive mutation routes using Redis.
- Mask party contact information and account identifiers in logs/audits where full values are unnecessary.

### HTTP and application hardening

- Apply secure headers through Helmet, including a deliberate Content Security Policy suitable for Next.js and Cloudinary origins.
- Use an explicit CORS origin allowlist from validated configuration; never reflect arbitrary origins or combine wildcard origins with credentials. Restrict methods and request headers.
- Configure Express `trust proxy` only for the known proxy topology so client IPs and secure cookies cannot be spoofed.
- Set small global body/query limits and tighter route-specific limits. Upload routes enforce file-count and byte limits and stream where practical to avoid memory exhaustion.
- Apply global and route-specific Redis-backed rate limits: stricter controls for login, uploads, exports, reconciliation, and other expensive mutations. Key by trustworthy client IP plus user/account where available.
- Reject duplicate/ambiguous query parameters and guard against HTTP parameter pollution and prototype pollution.
- Use runtime schemas to strip/reject unknown fields and normalize only explicitly supported values.
- Prisma parameterizes normal queries. Any raw SQL must use bound parameters/tagged safe APIs; string-built SQL is forbidden. Database credentials receive only required privileges.
- Prevent XSS by relying on React escaping, avoiding unsanitized HTML, validating URLs, and setting CSP. Protect cookie-authenticated mutations against CSRF.
- Prevent SSRF by never fetching arbitrary user-provided URLs; Cloudinary operations use trusted SDK endpoints and server-held configuration. Local storage resolves paths beneath one fixed root and rejects absolute paths, traversal segments, links escaping the root, and client-supplied storage keys.
- Return stable public errors without stack traces or database details; log internal errors with correlation IDs.
- Centralize Pino redaction for authorization/cookie headers, passwords, tokens, Cloudinary secrets/signatures, and sensitive body fields. Security events use stable event names without recording attacker-controlled content unnecessarily.
- Use dependency and secret scanning in CI, lock dependencies, rotate credentials, and keep secrets out of source and client bundles.

### DDoS and overload protection

Express cannot absorb a volumetric DDoS attack alone. Production should place the application behind a managed CDN/reverse proxy/WAF with network-level protection and request filtering. At the application layer use distributed rate limits, short header/request/keep-alive timeouts, bounded request bodies, bounded database/Redis pools, bounded BullMQ concurrency, queue back-pressure, pagination/export limits, and `503`/`429` responses under overload. Monitor anomalous traffic and maintain blocking/escalation runbooks.

## 10. Caching strategy

Cache only high-read, safely reconstructible data such as currencies, permission maps, and selected reference-data search results. Use short TTLs plus explicit invalidation. Do not cache payment outstanding values as authoritative facts.

## 11. Observability

- JSON logs with correlation ID, actor ID where known, route, duration, and outcome.
- Do not log request secrets or unmasked financial identifiers.
- `/health/live` verifies the process; `/health/ready` verifies required PostgreSQL and Redis connectivity.
- Track request latency/error rate, database pool saturation, BullMQ queue depth/failures, login failures, and financial-operation conflicts.

## 12. Local development

Local development does not use Docker. Developers install Node.js, the package manager, PostgreSQL, and Redis. `client` and `server` install and run independently, while root convenience scripts may start both. The normal server development command starts Express and the embedded worker; a separate command starts the worker alone. Cloudinary credentials are optional locally: when absent, uploads go to ignored `server/uploads/`. Environment documentation explains both providers and contains no production secrets.

## 13. Deployment and Docker

Docker is deployment packaging, not the development workflow. Production-oriented Compose may include `client`, `server`, optional standalone `worker`, `postgres`, and `redis`, with health checks and named volumes. API-only replicas set `START_EMBEDDED_WORKER=false` when the standalone worker service is enabled. Use multi-stage Dockerfiles, non-root runtime users, and locked dependencies. Migrations run as an explicit release job before application rollout, not independently in every replica.

## 14. Testing strategy

- Unit: status derivation, outstanding calculations, FX, rounding, transition policies.
- Integration: PostgreSQL repositories, migrations, RBAC, idempotency, audits, reconciliation bounds, automatic journals, and debit/credit balance.
- Operations: correlation-based structured logs, dependency readiness, non-sensitive HTTP/process metrics, worker lifecycle events, alerting guidance, and version-matched PostgreSQL backup/restore rehearsal.
- Concurrency: two simultaneous payments cannot overpay one payable.
- Contract: API responses match the shared/OpenAPI schema.
- End-to-end: login; create claim; upload/view a claim document; approve indemnity; partial/final/cross-currency payment; rejected overpayment; mobile-money reconciliation; filters/export.
