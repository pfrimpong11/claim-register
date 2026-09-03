# Operations and Recovery

## Observability

Every API request has a correlation ID and structured Pino completion/error log. Logs redact cookies, authorization values, tokens, hashes, uploaded bytes, and other configured sensitive fields. Worker ready, completed, failed, and queue/job identifiers are logged without job payloads. `/api/v1/health/live`, `/ready`, and `/metrics` provide process health, PostgreSQL/Redis/worker readiness, bounded HTTP counters, response timing, rate-limit counts, and process memory. Production should scrape metrics through a trusted internal route or proxy policy and alert on sustained 5xx/429 rates, failed jobs, readiness failure, database saturation, Redis errors, and financial conflict spikes.

During an incident, start with the correlation ID, inspect the matching structured API/error log, then check readiness and the BullMQ failed-job view. PostgreSQL remains authoritative: Redis loss may delay jobs or rate limits but must not change claims, payments, imports, matches, journals, or audit history. Retry only idempotent operations with the same key. Do not manually edit financial rows.

## Security and overload checklist

- Terminate TLS and absorb volumetric attacks at a managed CDN/WAF/reverse proxy; Express is not DDoS protection.
- Forward only trusted proxy headers and keep `TRUST_PROXY` aligned with the deployment topology.
- Keep credentialed CORS origins explicit; retain secure, HTTP-only session cookies and CSRF validation.
- Retain Helmet/CSP, body/file/field limits, HPP, Zod boundary validation, Prisma parameterization, and Redis-backed login/global limits.
- Use least-privilege database, Redis, Cloudinary, and deployment identities; rotate secrets through a secret manager.
- Keep queue concurrency and API/database pools bounded. Return `429` for abusive clients and `503` while dependencies are unavailable.
- Run locked dependency audit and secret scanning in CI. Investigate all critical/high findings before release.
- Never serve `server/uploads` statically. Scan uploaded documents for malware in a production implementation.

## Forward migrations

Run `npm run db:status --prefix server`, review every committed SQL migration, back up the target database, then run `npm run db:deploy --prefix server` once as a release operation. Applied migration files are immutable. Correct defects with a new forward migration; do not use schema push or automatic rollback.

## Backup and restore rehearsal

Use PostgreSQL's version-matched `pg_dump` and `pg_restore`. The operator supplies secrets through the environment or an approved password file; never place credentials in commands committed to this repository.

```powershell
pg_dump --format=custom --no-owner --no-acl --file claims-register.backup claims_register
createdb claims_register_restore_test
pg_restore --exit-on-error --no-owner --no-acl --dbname claims_register_restore_test claims-register.backup
```

Point a temporary `DATABASE_URL` at the restored database and run `npm run db:status --prefix server`. Verify migration history, row counts for claims/payables/payments/journals/audits, and a sample claim financial position. Destroy the isolated rehearsal database only after verification. Database backups do not contain local/Cloudinary document bodies, so storage backup/versioning and restore validation are separate requirements. Never restore over a live database without an approved recovery plan and maintenance window.
