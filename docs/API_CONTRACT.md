# API Contract Conventions

## 1. General

- Base path: `/api/v1`.
- JSON uses camelCase; database names remain snake_case.
- Money and FX decimals are strings.
- Dates are `YYYY-MM-DD`; timestamps are ISO 8601 UTC.
- Mutating financial endpoints accept `Idempotency-Key`.
- Responses include/echo a correlation ID.
- OpenAPI is generated from the JavaScript server's runtime schemas and checked in CI; frontend types are generated from the contract without sharing backend source code across the `client`/`server` boundary.

## 2. Error shape

```json
{
  "error": {
    "code": "PAYMENT_EXCEEDS_OUTSTANDING",
    "message": "The settlement amount exceeds the payable's outstanding balance.",
    "details": {
      "outstanding": "1000.00",
      "currency": "GHS"
    },
    "correlationId": "..."
  }
}
```

Expected classes: validation `400`, authentication `401`, authorization `403`, missing `404`, state/conflict/idempotency `409`, rate limit `429`, unexpected `500`.

## 3. Resource outline

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /parties
POST   /parties
GET    /policies
POST   /policies
GET    /currencies

GET    /claims
POST   /claims
GET    /claims/:id
PATCH  /claims/:id
GET    /claims/:id/documents
POST   /claims/:id/documents
GET    /documents/:id/download
POST   /documents/:id/deactivate
POST   /claims/:id/payables
POST   /payables/:id/approve
POST   /payables/:id/cancel
POST   /payables/:id/payments
POST   /payments/:id/approve
POST   /payments/:id/mark-successful
POST   /payments/:id/reverse

GET    /settlement-accounts
POST   /transaction-imports
GET    /external-transactions
POST   /reconciliation-matches
POST   /reconciliation-matches/:id/reverse

GET    /reports/claims-summary
GET    /reports/claims-export
GET    /accounting/journals
GET    /accounting/journals/:id
GET    /audit-logs
GET    /health/live
GET    /health/ready
```

## 4. Claims register query

`GET /claims` accepts `page`, `pageSize`, `sort`, `direction`, `search`, `policy`, `insured`, `lossNature`, `currency`, `status`, `lossFrom`, `lossTo`, `notificationFrom`, and `notificationTo`. The response contains `data`, page metadata, and filtered totals grouped by currency. The exact same database filter object is reused for rows, count, and grouped summaries to prevent definition drift.

`POST /claims` accepts `policyId`, `lossDate`, `notificationDate`, `lossNature`, optional `description`, decimal-string `estimatedLossAmount`, and an override reason when notification predates loss. It atomically creates the claim, immutable policy/insured/currency snapshots, initial active indemnity reserve, `RESERVED_NOT_SETTLED` history, and audit record.

Reference searches accept `q` and bounded `limit`. Party creation accepts type, display name, and optional email/phone. Policy creation accepts number, optional name, insured party, currency, and optional effective dates.

## 5. Concurrency

Use an optimistic version field for ordinary editable records. Financial transitions additionally use a database transaction and locked/serializable revalidation. Return `409` when a stale or conflicting state prevents completion.
