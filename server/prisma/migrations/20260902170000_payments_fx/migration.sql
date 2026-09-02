CREATE TYPE "SettlementAccountType" AS ENUM ('BANK', 'MOBILE_MONEY', 'PAYMENT_GATEWAY', 'CASH', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'APPROVED', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REVERSED');
CREATE TYPE "JournalStatus" AS ENUM ('POSTED', 'REVERSED');
ALTER TABLE "journal_entries" ADD COLUMN "status" "JournalStatus" NOT NULL DEFAULT 'POSTED', ADD COLUMN "reversal_of_entry_id" UUID;
CREATE INDEX "journal_entries_reversal_of_entry_id_idx" ON "journal_entries"("reversal_of_entry_id");
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_entry_id_fkey" FOREIGN KEY ("reversal_of_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "settlement_accounts" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "account_type" "SettlementAccountType" NOT NULL,
  "provider_name" VARCHAR(150),
  "masked_identifier" VARCHAR(100) NOT NULL,
  "currency_code" CHAR(3) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "settlement_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "claim_payments" (
  "id" UUID NOT NULL,
  "payment_number" VARCHAR(50) NOT NULL,
  "claim_id" UUID NOT NULL,
  "payable_id" UUID NOT NULL,
  "payee_party_id" UUID NOT NULL,
  "payment_date" DATE NOT NULL,
  "payment_amount" DECIMAL(19,4) NOT NULL,
  "payment_currency_code" CHAR(3) NOT NULL,
  "fx_rate" DECIMAL(20,8) NOT NULL,
  "settlement_amount" DECIMAL(19,4) NOT NULL,
  "settlement_currency_code" CHAR(3) NOT NULL,
  "settlement_account_id" UUID NOT NULL,
  "reference" VARCHAR(200),
  "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by" UUID NOT NULL,
  "approved_by" UUID,
  "approved_at" TIMESTAMPTZ(6),
  "succeeded_by" UUID,
  "succeeded_at" TIMESTAMPTZ(6),
  "reversed_by" UUID,
  "reversed_at" TIMESTAMPTZ(6),
  "reversal_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "claim_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "claim_payments_positive_values" CHECK ("payment_amount" > 0 AND "fx_rate" > 0 AND "settlement_amount" > 0),
  CONSTRAINT "claim_payments_same_currency_rate" CHECK ("payment_currency_code" <> "settlement_currency_code" OR "fx_rate" = 1),
  CONSTRAINT "claim_payments_lifecycle_consistent" CHECK (
    ("status" = 'DRAFT' AND "approved_by" IS NULL AND "approved_at" IS NULL AND "succeeded_by" IS NULL AND "succeeded_at" IS NULL AND "reversed_by" IS NULL AND "reversed_at" IS NULL)
    OR ("status" IN ('APPROVED','PROCESSING','FAILED') AND "approved_by" IS NOT NULL AND "approved_at" IS NOT NULL AND "succeeded_by" IS NULL AND "succeeded_at" IS NULL AND "reversed_by" IS NULL AND "reversed_at" IS NULL)
    OR ("status" = 'SUCCESSFUL' AND "approved_by" IS NOT NULL AND "approved_at" IS NOT NULL AND "succeeded_by" IS NOT NULL AND "succeeded_at" IS NOT NULL AND "reversed_by" IS NULL AND "reversed_at" IS NULL)
    OR ("status" = 'REVERSED' AND "approved_by" IS NOT NULL AND "approved_at" IS NOT NULL AND "succeeded_by" IS NOT NULL AND "succeeded_at" IS NOT NULL AND "reversed_by" IS NOT NULL AND "reversed_at" IS NOT NULL AND "reversal_reason" IS NOT NULL)
  )
);

CREATE TABLE "payment_number_sequences" ("year" INTEGER NOT NULL, "next_value" INTEGER NOT NULL DEFAULT 1, CONSTRAINT "payment_number_sequences_pkey" PRIMARY KEY ("year"));
CREATE TABLE "idempotency_keys" (
  "id" UUID NOT NULL,
  "scope" VARCHAR(100) NOT NULL,
  "key" VARCHAR(200) NOT NULL,
  "actor_id" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "response_code" INTEGER NOT NULL,
  "response_body" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "settlement_accounts_code_key" ON "settlement_accounts"("code");
CREATE INDEX "settlement_accounts_status_account_type_currency_code_idx" ON "settlement_accounts"("status", "account_type", "currency_code");
CREATE UNIQUE INDEX "claim_payments_payment_number_key" ON "claim_payments"("payment_number");
CREATE INDEX "claim_payments_payable_id_status_payment_date_idx" ON "claim_payments"("payable_id", "status", "payment_date");
CREATE INDEX "claim_payments_claim_id_status_idx" ON "claim_payments"("claim_id", "status");
CREATE INDEX "claim_payments_settlement_account_id_payment_date_idx" ON "claim_payments"("settlement_account_id", "payment_date");
CREATE UNIQUE INDEX "idempotency_keys_scope_key_actor_id_key" ON "idempotency_keys"("scope", "key", "actor_id");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

ALTER TABLE "settlement_accounts" ADD CONSTRAINT "settlement_accounts_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "claim_payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_payee_party_id_fkey" FOREIGN KEY ("payee_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_payment_currency_code_fkey" FOREIGN KEY ("payment_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_settlement_currency_code_fkey" FOREIGN KEY ("settlement_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_settlement_account_id_fkey" FOREIGN KEY ("settlement_account_id") REFERENCES "settlement_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_succeeded_by_fkey" FOREIGN KEY ("succeeded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
