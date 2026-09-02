# Local Development

Local development runs directly on the host; Docker is not required or used.

## Prerequisites

- Node.js 22 or newer and npm 10 or newer.
- PostgreSQL available on the configured `DATABASE_URL`.
- Redis available on the configured `REDIS_URL`.
- Cloudinary is optional. If all three Cloudinary values are absent, documents use ignored `server/uploads/`. Partial configuration is rejected.

## Setup

1. Run `npm install` from the repository root. The root lockfile covers both separate packages.
2. Copy `server/.env.example` to `server/.env` and adjust PostgreSQL/Redis settings.
3. Copy `client/.env.example` to `client/.env.local` if the default API URL is unsuitable.
4. Create the PostgreSQL database named in `DATABASE_URL`.
5. Start PostgreSQL and Redis using the host's normal service manager.
6. Set a development-only `SEED_DEFAULT_PASSWORD` of at least 16 characters.
7. Run `npm run db:generate --prefix server`, `npm run db:deploy --prefix server`, and `npm run db:seed --prefix server`.
8. Run `npm run dev` at the root to start the client and server. The server starts its embedded worker automatically.

The seed is deterministic and safe to rerun outside production. It creates development accounts under `@claims.local`; their shared password is read only from `SEED_DEFAULT_PASSWORD` and is never stored in the repository.

## Database migrations

Run these commands from the repository root:

```text
npm run db:validate --prefix server
npm run db:status --prefix server
npm run db:deploy --prefix server
npm run db:seed --prefix server
```

- `db:validate` checks the Prisma schema and configuration without changing the database.
- `db:status` compares committed migrations with the database migration table and reports pending or divergent history.
- `db:deploy` applies pending committed migrations without generating new ones. Use this for initial setup, CI, and shared environments.
- `db:seed` upserts the deterministic development identity data and is safe to repeat outside production.

When intentionally changing the schema during development, update `server/prisma/schema.prisma`, then create and apply a named migration:

```text
npm run db:migrate:dev --prefix server -- --name describe_the_change
```

Review the generated SQL before committing it. Once a migration has been applied to any shared environment, it is immutable: do not edit, rename, reorder, or delete it. Correct mistakes with a new forward migration. Do not use `prisma db push` for this project. Database backup restoration and carefully investigated failed-migration repair are operational recovery procedures, not reasons to rewrite migration history.

Package-specific commands remain independent:

```text
npm run dev --prefix client
npm run dev --prefix server
npm run dev:worker --prefix server
```

To detach background processing, run the server with `START_EMBEDDED_WORKER=false` and start `npm run dev:worker --prefix server` separately.

## Health and verification

- Client: `http://localhost:3000`
- API liveness: `http://localhost:4000/api/v1/health/live`
- API readiness: `http://localhost:4000/api/v1/health/ready`
- Full quality suite: `npm run verify`

Readiness requires PostgreSQL and Redis. When the embedded worker is enabled, it also requires the worker to be ready.

## Environment safety

- Never commit `.env` files or real credentials.
- Use a development Cloudinary account/folder only.
- `server/uploads/` is not public and must not be exposed with static Express middleware.
- `TRUST_PROXY=false` is correct for direct local access; configure the exact proxy topology in deployment.
