# Product Requirements

## 1. Purpose

The product is a mini insurance claims register that demonstrates sound handling of claim registration, indemnity approval, payments, outstanding balances, multi-currency settlement, reconciliation, access control, and auditability.

It begins when a loss is reported. It references policy and insured-party information but does not own full policy administration or premium collection.

## 2. Goals

- Register and browse claims with the information required by the project brief.
- Keep estimated loss/reserve, approved indemnity, paid amount, and outstanding amount conceptually separate.
- Support one approved indemnity being settled by one or more payments.
- Correctly handle payments made in a currency different from the claim currency.
- Prevent overpayment under concurrency.
- Reconcile successful payments against independent bank, mobile-money, gateway, or imported transactions.
- Provide filters, currency-grouped totals, role-based access, and an audit trail.
- Be immediately demonstrable with realistic Ghana-focused seed data while allowing minimal new party and policy creation.

## 3. Exercise boundaries

- Full policy lifecycle, endorsements, renewals, underwriting, or coverage engine.
- Premium invoicing, collection, arrears, commissions, or premium reconciliation.
- Full party/customer administration.
- Full reserve-movement, assessment, excess, recoveries, reinsurance, document workflow/versioning/OCR, communication, or IFRS 17 modules.
- Automated execution of real bank or mobile-money transfers.
- A general-purpose accounting package. The exercise includes only event-generated GL accounts, journal entries, and balanced journal lines for the claims events described below.
- Automatic provider integrations or scheduled statement ingestion; CSV/manual import is sufficient for the exercise.

## 4. Users and seeded roles

| Role            | Primary capabilities                                                           |
| --------------- | ------------------------------------------------------------------------------ |
| Admin           | Full access, user and role administration                                      |
| Claims Officer  | Create/update claims and reserves; add parties/policies; prepare payables      |
| Claims Manager  | Review claims; approve indemnity payables; view reports                        |
| Finance Officer | Record payments; import transactions; reconcile; view journals                 |
| Finance Manager | Approve/reverse payments; manage reconciliation; view journals; export reports |

Permissions are enforced by the API. Seeded roles are defaults, not hard-coded authorization logic.

## 5. Core workflow

1. User selects a seeded policy or creates a minimal policy inline.
2. User registers a claim and its initial estimated loss, represented as an active indemnity reserve.
3. An indemnity payable is created and approved for a payee.
4. One or more payments are recorded against that payable.
5. For cross-currency payment, the system stores the payment currency, rate, and claim-currency settlement amount.
6. Successful payments reduce the indemnity outstanding balance.
7. External transactions may be imported and matched to payments independently.
8. The register and dashboard show derived financial status and totals grouped by currency.

## 6. Functional requirements

### Authentication and authorization

- FR-001: Users can sign in with email and password and sign out.
- FR-002: Disabled users cannot authenticate.
- FR-003: Protected operations require explicit permissions.
- FR-004: Sessions use secure, HTTP-only cookies; state-changing requests receive CSRF protection where applicable.

### Parties and policies

- FR-010: The system seeds realistic people and organizations.
- FR-011: Users can search/select an existing party.
- FR-012: Authorized users can create a party from a minimal modal: type, display name, optional email and phone.
- FR-013: The system seeds policies linked to insured parties.
- FR-014: Users can search policies by policy number, policy name, or insured name.
- FR-015: Authorized users can create a minimal policy inline: number, optional name, insured party, currency, optional effective dates.
- FR-016: The system does not provide standalone policy or party administration in the exercise.

### Claims and reserves

- FR-020: A claim captures a generated claim number, policy, loss date, notification date, loss nature, optional description, claim currency, and estimated loss amount.
- FR-021: Policy number and insured name are resolved through the selected policy and snapshotted sufficiently to preserve historical display.
- FR-022: Claim currency defaults from the policy and is snapshotted on the claim.
- FR-023: Notification date cannot precede loss date without an authorized override and reason.
- FR-024: The initial estimated loss creates an active `INDEMNITY` reserve.
- FR-025: The claim detail view shows its reserve, payable, payments, reconciliation, status history, and audit activity.

### Claim documents

- FR-026: Authorized users can upload a document from the claim detail page, select its document type, and provide an optional description.
- FR-027: Document types include `CLAIM_FORM`, `POLICE_REPORT`, `ID_DOCUMENT`, `VEHICLE_DOCUMENT`, `LOSS_PHOTO`, `ESTIMATE`, `INVOICE`, `ADJUSTER_REPORT`, `PAYMENT_PROOF`, and `OTHER`.
- FR-028: The system records the storage provider, provider-neutral storage key, optional Cloudinary public/asset identifiers and delivery metadata, MIME type/format, byte size, uploader, upload time, description, and status.
- FR-029: Authorized users can list, view, and download active claim documents. Removing a document deactivates its metadata and storage reference; it does not erase its audit history.
- FR-029A: Uploads enforce an allowlist of MIME types/extensions, magic-byte verification where supported, configurable size limits, randomized storage identifiers, and authorization on every view/download. User-supplied paths and Cloudinary transformation parameters are never trusted.
- FR-029C: At startup, complete Cloudinary configuration selects the Cloudinary adapter. When Cloudinary configuration is absent, the system automatically selects a local adapter rooted at `server/uploads/`.
- FR-029D: Local files are stored outside any public/static directory and are available only through the same authorized document API used for cloud-backed files.
- FR-029B: The exercise does not require document versioning, OCR, document approval, or mandatory-document rules.

### Payables

- FR-030: A claim can have multiple payables in the model.
- FR-031: The exercise workflow creates indemnity payables; additional types may exist in the enum for model clarity but are not seeded or exposed as complete workflows.
- FR-032: A payable has a payee, amount, currency, lifecycle status, and approval metadata.
- FR-033: Only approved, non-cancelled payables can receive successful payment allocation.
- FR-034: Approval and cancellation are auditable state transitions.

### Payments and foreign exchange

- FR-040: A payable can have multiple payments.
- FR-041: A payment stores payment amount/currency, FX rate, settlement amount/currency, date, settlement account, reference, status, and approval metadata.
- FR-042: The canonical FX definition is: `1 payment-currency unit = fx_rate claim-currency units`.
- FR-043: Settlement currency equals the payable/claim currency.
- FR-044: Same-currency payments use an FX rate of exactly 1.
- FR-045: Successful, non-reversed settlement amounts cannot exceed the approved payable amount.
- FR-046: Overpayment prevention is enforced atomically by the backend and remains correct under concurrent requests.
- FR-047: A payment may transition through `DRAFT`, `APPROVED`, `PROCESSING`, `SUCCESSFUL`, `FAILED`, and `REVERSED` according to allowed transitions.
- FR-048: Reversal creates an auditable reversal; it does not delete or rewrite the original payment.
- FR-049: Payment creation/approval endpoints support idempotency keys.

### Calculations and claim financial status

- FR-050: Approved amount equals approved, non-cancelled `INDEMNITY` payables in claim currency.
- FR-051: Total paid equals successful, non-reversed payments allocated to indemnity payables, using stored settlement amounts.
- FR-052: Outstanding equals `max(approved indemnity - total paid, 0)`.
- FR-053: Before an approved indemnity exists, financial status is `RESERVED_NOT_SETTLED`.
- FR-054: Approved indemnity with positive outstanding is `SETTLED_PAYMENT_OUTSTANDING`.
- FR-055: Approved indemnity with zero outstanding is `SETTLED_AND_PAID`.
- FR-056: Reconciliation status does not change these financial calculations.
- FR-057: Totals across claims are grouped by currency; unlike currencies are never silently summed.

### Lightweight general ledger

- FR-058: The system seeds only the GL accounts needed by the exercise: Claims Expense, Claims Payable, and Settlement Assets/Cash.
- FR-058A: Approving an indemnity payable generates and posts a balanced journal in the claim currency: debit Claims Expense and credit Claims Payable.
- FR-058B: Marking a payment successful generates and posts a balanced journal in the claim currency using the stored settlement amount: debit Claims Payable and credit Settlement Assets/Cash.
- FR-058C: Reversing a successful payment generates a linked reversal journal; posted journals are never edited or deleted.
- FR-058D: Journal creation is automatic and atomic with the originating business event. Authorized users can view journals but cannot manually compose or post them.
- FR-058E: Each journal links to its source entity and claim, has a unique journal number, entry date, description, currency, posting time, and balanced lines.
- FR-058F: For the exercise, journals balance in the claim/payable currency using stored settlement equivalents. Full functional-currency accounting, revaluation, exchange differences, configurable accounting rules, periods, and IFRS 17 treatment are documented as improvements with more time.

### Register, filters, and reporting

- FR-060: The register displays claim number, policy number/name, insured, loss date, notified date, loss nature, currency, estimated loss, approved amount, paid amount, outstanding amount, and derived financial status.
- FR-061: Users can filter by claim number/search text, policy, insured, loss nature, currency, status, loss-date range, and notified-date range.
- FR-062: Filtering, sorting, and pagination are server-side and represented in the URL.
- FR-063: Summary cards/totals respect the active filters and are grouped by currency.
- FR-064: Authorized users can export the filtered register to CSV with the same definitions used on screen.

### Settlement accounts and reconciliation

- FR-070: Settlement accounts support `BANK`, `MOBILE_MONEY`, `PAYMENT_GATEWAY`, `CASH`, and `OTHER`.
- FR-071: Seed data includes Ghanaian bank and mobile-money examples.
- FR-072: External transactions record account, reference, dates, debit/credit direction, amount, currency, description, source, and reconciliation status.
- FR-073: Sources support bank statement, mobile-money statement, gateway webhook, and manual import.
- FR-074: A payment can be successful while still unreconciled.
- FR-075: Authorized users can manually match/unmatch compatible payments and external transactions.
- FR-076: Matches support partial amounts in the data model; the first UI may focus on one-to-one full matches.
- FR-077: Matching cannot exceed the unmatched amount of either side and is enforced atomically.

### Audit and operations

- FR-080: Security-sensitive and financial actions append an audit record with actor, action, entity, before/after data, request metadata, and time.
- FR-081: Sensitive values such as password hashes, tokens, and full financial identifiers are excluded or masked in audit data.
- FR-082: Health endpoints distinguish liveness from database/Redis readiness.

## 7. Business invariants

- Amounts are positive decimal values with explicit ISO 4217 currency codes.
- Financial values use decimal arithmetic; floats are forbidden.
- A payment's payable, claim, payee, and settlement currency must be mutually consistent.
- Successful payment settlement total cannot exceed the approved payable.
- Historical payment FX data is immutable after success; correction requires reversal and replacement.
- Claim status shown in the register is derived, not manually edited.
- Payment execution status and reconciliation status remain separate.
- Cross-currency totals are grouped, never converted without an explicit reporting rate and date.

## 8. Non-functional requirements

- NFR-001 Security: OWASP-aligned runtime validation, authorization, Argon2id password hashing, secure cookies, CSRF protection, strict CORS allowlisting, safe headers, request-size limits, parameter-pollution protection, Redis-backed rate limiting, injection defenses, secure upload handling, dependency scanning, and secrets management.
- NFR-001A Availability: production traffic is expected to pass through a trusted reverse proxy/CDN/WAF with volumetric DDoS protection. The Express layer adds per-route/global limits, connection/request timeouts, bounded concurrency/queues, graceful overload responses, health checks, and graceful shutdown. No application-level control is represented as complete DDoS protection.
- NFR-002 Reliability: all financial state transitions are transactional and idempotent.
- NFR-003 Performance: p95 register reads under 500 ms for 100,000 claims in the reference environment, excluding network latency.
- NFR-004 Accessibility: keyboard-operable UI, meaningful labels, visible focus, and WCAG 2.2 AA-oriented contrast.
- NFR-005 Observability: structured logs with request/correlation IDs; metrics for errors, latency, queues, and database pool health.
- NFR-006 Maintainability: checked/documented JavaScript on the server, typed frontend code, modular boundaries, migration history, tests, and documented decisions.
- NFR-007 Portability: local development runs directly on the host without Docker. PostgreSQL and Redis connection details are supplied through environment configuration; Docker packaging remains available for deployment.
- NFR-008 Privacy: personally identifiable data is minimized in logs, exports, and seed data.

## 9. Seed-data requirements

- Currencies: at least GHS, USD, EUR, GBP.
- Parties: 15–25 fictional Ghana-focused people and organizations.
- Policies: 15–20 policies tied to seeded parties.
- Claims: enough records to demonstrate each financial state, pagination, date/currency filters, and same/cross-currency payments.
- Payables: only `INDEMNITY` payables in seed data.
- Settlement accounts: at least one bank account and one mobile-money wallet.
- External transactions: matched and unmatched examples.
- Documents: a few safe fictional document metadata records; development fixtures must not contain real personal data.
- Users: one documented development account for each seeded role; non-production credentials only.

## 10. Acceptance journey

An evaluator can sign in, view/filter currency-grouped claims, create a claim using seeded or inline-created reference data, upload a claim document, approve an indemnity, inspect its automatic journal, record partial and final payments (including one cross-currency example), observe outstanding/status updates, see an overpayment rejected, inspect payment/reversal journals, import or view a mobile-money transaction, reconcile it independently, export the filtered register, and inspect the audit history.
