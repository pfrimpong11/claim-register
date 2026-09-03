# Data Model

## 1. Conventions

- PostgreSQL UUID primary keys.
- `created_at` and `updated_at` are UTC `timestamptz` values.
- Business dates use `date`.
- Currency codes reference `currencies.code`.
- Use Prisma migrations and database constraints/indexes; service validation complements rather than replaces them.
- Soft deletion is avoided for financial records. Reference data uses status flags; financial corrections use cancellation/reversal.

## 2. Relationship overview

```text
Party <-- Policy <-- Claim --> Reserve
  ^                    |
  |                    v
  +--------------- Payable <-- Payment --> SettlementAccount
                                      |
                                      v
                              ReconciliationMatch
                                      ^
                                      |
                            ExternalTransaction

User <-> Role <-> Permission
Claim --> StatusHistory
Claim --> ClaimDocument
Payable/Payment --> JournalEntry --> JournalLine --> GLAccount
All important entities --> AuditLog
```

## 3. Core tables

### Identity and access

- `users`: id, email unique, password_hash, first_name, last_name, status, last_login_at, timestamps.
- `roles`: id, code unique, name, description, timestamps.
- `permissions`: id, code unique, name, module.
- `user_roles`: user_id, role_id, composite primary key.
- `role_permissions`: role_id, permission_id, composite primary key.
- `sessions`: id/token hash, user_id, expires_at, revoked_at, metadata.

### Reference data

- `currencies`: code char(3) primary key, name, symbol, decimal_places, is_active.
- `parties`: id, party_type (`PERSON`, `ORGANIZATION`), display_name, email nullable, phone nullable, status, timestamps.
- `policies`: id, policy_number unique, policy_name nullable, insured_party_id, currency_code, effective_from/to nullable, status, timestamps.
- `settlement_accounts`: id, account_type, name, provider_name, currency_code, account_identifier, account_name nullable, is_active, timestamps.

### Claims

- `claims`: id, claim_number unique, policy_id, policy_number_snapshot, policy_name_snapshot nullable, insured_name_snapshot, loss_date, date_notified, loss_nature, description nullable, currency_code, created_by, timestamps.
- `claim_reserves`: id, claim_id, reserve_type, amount, currency_code, status, reason nullable, created_by, timestamps.
- `claim_status_history`: id, claim_id, from_status nullable, to_status, reason nullable, changed_by, changed_at.
- `claim_documents`: id, claim_id, document_type, original_file_name, storage_provider, storage_key unique, Cloudinary identifiers/delivery metadata nullable, MIME/format and byte size, provider metadata, description nullable, status, uploader/time, deactivation actor/time, and durable cleanup status/attempt/error/completion fields.

The exercise has one active indemnity reserve per claim. With more time, reserve movements would preserve every reserve adjustment.

### Payables and payments

- `claim_payables`: id, claim_id, payee_party_id, payable_type, amount, currency_code, status, description nullable, approved_by/at nullable, created_by, timestamps.
- `claim_payments`: id, payment_number unique, claim_id, payable_id, payee_party_id, payment_date, payment_amount, payment_currency, fx_rate, settlement_amount, settlement_currency, settlement_account_id, reference nullable, status, created/approved/succeeded actors and times, reversal actor/time/reason nullable, timestamps.
- `idempotency_keys`: id, scope, key, actor_id, request_hash, response_code/body, expires_at, created_at; unique `(scope, key, actor_id)`.

For the exercise a payment belongs to exactly one payable. Reversal transitions a successful payment to `REVERSED`, retains its immutable amount/FX facts, and creates a linked reversal journal; it does not create a negative payment row. With more time, `payment_allocations` would let one payment cover several payables without changing historical payment semantics.

### Reconciliation

- `transaction_imports`: id, source_type, settlement_account_id, source_file_name, protected temporary storage path, status, total/imported/duplicate/failed row counts, imported_by/at, bounded error_summary nullable.
- `external_transactions`: id, settlement_account_id, import_id nullable, external_reference, transaction_date, value_date nullable, transaction_type, amount, currency_code, description nullable, source_type, reconciliation_status, timestamps.
- `reconciliation_matches`: id, payment_id, external_transaction_id, matched_amount, currency_code, status, match_type, matched_by/at, notes nullable, reversed_at/by nullable.

Import files are temporary worker inputs under protected `server/uploads/imports/`; they are not served statically and are deleted after successful or partially successful processing. PostgreSQL import state and external transactions remain authoritative. Active match totals determine payment/external unmatched values. Reversal changes the match to `REVERSED` with actor, time, and reason rather than deleting it.

### Governance

- `audit_logs`: id, actor_user_id nullable, action, entity_type, entity_id, old_values jsonb nullable, new_values jsonb nullable, correlation_id, ip_address nullable, user_agent nullable, occurred_at.
- `report_exports`: id, report_type, validated filters jsonb, status, protected file path/name nullable, row count, bounded error nullable, requested_by, completion/expiry timestamps.

### Lightweight general ledger

- `gl_accounts`: id, code unique, name, account_type (`ASSET`, `LIABILITY`, `EXPENSE` for the seeded exercise accounts), is_active, timestamps.
- `journal_entries`: id, journal_number unique, entry_date, source_type (`CLAIM_PAYABLE`, `CLAIM_PAYMENT`, `PAYMENT_REVERSAL`), source_id, claim_id, description, currency_code, status (`POSTED`, `REVERSED`), reversal_of_entry_id nullable, created_at, posted_at.
- `journal_lines`: id, journal_entry_id, gl_account_id, debit_amount, credit_amount, currency_code, claim_id, party_id nullable, created_at.

Each line has exactly one positive side. Every posted entry balances in one currency. Journals are generated by application services, not manually entered.

## 4. Enums

- Party type: `PERSON`, `ORGANIZATION`.
- Reference status: `ACTIVE`, `INACTIVE`.
- Reserve type: `INDEMNITY`, `ADJUSTER_FEE`, `LEGAL_FEE`, `MEDICAL_FEE`, `OTHER`.
- Reserve status: `ACTIVE`, `RELEASED`, `SUPERSEDED`.
- Payable type: `INDEMNITY`, `ADJUSTER_FEE`, `LEGAL_FEE`, `MEDICAL_FEE`, `OTHER`.
- Payable status: `DRAFT`, `APPROVED`, `CANCELLED`.
- Payment status: `DRAFT`, `APPROVED`, `PROCESSING`, `SUCCESSFUL`, `FAILED`, `REVERSED`.
- Settlement account type: `BANK`, `MOBILE_MONEY`, `PAYMENT_GATEWAY`, `CASH`, `OTHER`.
- External transaction type: `DEBIT`, `CREDIT`.
- External source: `BANK_STATEMENT`, `MOMO_STATEMENT`, `GATEWAY_WEBHOOK`, `MANUAL_IMPORT`.
- Reconciliation status: `UNMATCHED`, `PARTIALLY_MATCHED`, `MATCHED`.
- Match type: `AUTO`, `MANUAL`; the exercise implements manual matching.
- Document type: `CLAIM_FORM`, `POLICE_REPORT`, `ID_DOCUMENT`, `VEHICLE_DOCUMENT`, `LOSS_PHOTO`, `ESTIMATE`, `INVOICE`, `ADJUSTER_REPORT`, `PAYMENT_PROOF`, `OTHER`.
- Document status: `ACTIVE`, `INACTIVE`.
- Storage provider: `LOCAL`, `CLOUDINARY`.

## 5. Derived read model

The claims register query derives, per claim:

```text
estimated_loss = active indemnity reserve amount
approved_amount = sum(approved indemnity payables)
paid_amount = sum(successful, non-reversed settlement amounts for indemnity payables)
outstanding_amount = greatest(approved_amount - paid_amount, 0)
```

Financial status:

```text
approved_amount = 0                         -> RESERVED_NOT_SETTLED
approved_amount > 0 and outstanding > 0    -> SETTLED_PAYMENT_OUTSTANDING
approved_amount > 0 and outstanding = 0    -> SETTLED_AND_PAID
```

These are the exercise-defined claim statuses and the only claim statuses shown in the register. They are canonical derived values. `claim_status_history` may record transitions between these derived states for audit/reporting, but it never overrides the calculation.

Implement this initially as a well-indexed query/repository projection. Introduce a materialized read model only after measurement demonstrates a need.

## 6. Constraints and indexes

- Check all monetary amounts are positive and FX rates are positive.
- Check policy and claim date ranges are valid.
- Unique human identifiers: claim number, payment number, policy number.
- Unique provider transaction identity per account, normally `(settlement_account_id, external_reference, transaction_date, amount)` or a provider-issued immutable ID when available.
- Index claims by loss/notified dates, currency, policy, and creation time. Status filtering uses the derived register query/read model.
- Index policy number and normalized insured/party search fields; use PostgreSQL trigram search only when justified.
- Index payables by claim/status/type and payments by payable/status/date.
- Index unmatched external transactions by account/currency/date/status.
- Index audit logs by entity and time, and actor and time.
- Index claim documents by claim/status/upload time; `storage_key` is unique and randomized. Cloudinary asset/public IDs are unique when present. Local keys are generated identifiers, never user filenames or absolute paths.
- Index journal entries by source, claim, entry date, and journal number; index journal lines by journal and GL account.

Journal balance is verified by the accounting service inside the originating transaction. Line-level checks alone cannot prove whole-entry balance.

Cross-row limits such as overpayment and overmatching require transactional application logic because a simple check constraint cannot safely express them.

## 7. Number generation

Use database-backed counters scoped by year for readable identifiers such as `CLM-2026-000001` and `PAY-2026-000001`. Generation must be atomic. Gaps are acceptable; duplicates are not.
