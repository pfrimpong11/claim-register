# Claims Register

A focused, production-minded claims register for recording insurance claims, approving indemnity payables, processing multi-currency payments, reconciling payments against bank, mobile-money, or payment-provider transactions, and generating a lightweight general ledger.

## Technology baseline

- Frontend: Next.js 16, React 19, TypeScript
- Backend: Node.js, Express, modern JavaScript (ES modules), modular architecture
- Server validation and logging: Zod and Pino
- Document storage: Cloudinary when configured; protected `server/uploads/` fallback otherwise
- Database: PostgreSQL
- ORM and migrations: Prisma
- Cache and background work: Redis with BullMQ
- Local development: native Node.js processes with locally configured PostgreSQL and Redis; no Docker required or used
- Deployment packaging: Docker and Docker Compose
- Package management: separate `client` and `server` packages, managed from root scripts
- Testing: Vitest/Jest-compatible unit tests, API integration tests, and Playwright end-to-end tests

## Scope and key decisions

- Claim status is derived from approved indemnity and successful allocated payments: `RESERVED_NOT_SETTLED`, `SETTLED_PAYMENT_OUTSTANDING`, or `SETTLED_AND_PAID`.
- Money is stored as PostgreSQL `numeric`, transferred through the API as decimal strings, and calculated without JavaScript floating-point arithmetic.
- Cross-currency payments retain the historical exchange rate and claim-currency equivalent used when recorded. Register totals are grouped by claim currency.
- Seed data contains only `INDEMNITY` payables. Parties and policies are seeded reference data, with minimal point-of-need creation instead of full administration modules.
- Reconciliation uses generic settlement accounts and external transactions so both bank and mobile-money sources are supported.
- The general ledger is deliberately lightweight: journals are generated from claim events rather than entered manually.
- Permissions are enforced throughout the application; maker-checker separation and monetary authority limits are outside the scope of this exercise.
- Claim documents support upload, classification, description, authorized access, and deactivation. Cloudinary is used when fully configured; otherwise files use the protected local fallback.

## Documentation

- [Product requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [API conventions](docs/API_CONTRACT.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Local development](docs/LOCAL_DEVELOPMENT.md)

## Repository layout

```text
client/              Next.js 16 / React 19 frontend
server/              Node.js / Express backend
  uploads/           Local document fallback (contents ignored by Git)
  prisma/            Prisma schema, migrations, seed data
  src/
    modules/          Domain modules
    worker/           BullMQ jobs, processors, and worker entry point
    middleware/       Cross-cutting Express middleware
    shared/           Logging, validation, errors, security, utilities
docs/
infra/
  docker/
```

The default server command starts the HTTP API and BullMQ worker in the same runtime. A separate command starts only the worker, allowing it to run and scale independently while remaining part of the server application.

## Local start

Local development requires PostgreSQL and Redis but does not require Docker. Follow [Local development](docs/LOCAL_DEVELOPMENT.md) for the complete setup. In summary, install dependencies with `npm install`, configure the client and server environment files, and run `npm run dev`. This starts the frontend and backend, including the backend worker.

## With more time

A production system would add richer reserve movements and claims workflow; multiple payable types and payment allocations; recoveries, salvage, subrogation, and reinsurance; maker-checker approvals and monetary authority limits; full policy, party, and premium domains; functional-currency accounting, FX gains/losses, periods, finance integration, and IFRS 17 treatment; automated many-to-many reconciliation and direct bank/mobile-money integrations; document versioning, malware scanning, OCR, retention controls, and previews; and stronger operational controls such as managed WAF/CDN tuning, autoscaling, observability, disaster recovery, penetration testing, and formal threat modelling.
