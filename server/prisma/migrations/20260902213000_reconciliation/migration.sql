CREATE TYPE "ExternalTransactionType" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "ExternalTransactionSource" AS ENUM ('BANK_STATEMENT', 'MOMO_STATEMENT', 'GATEWAY_WEBHOOK', 'MANUAL_IMPORT');
CREATE TYPE "TransactionImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNMATCHED', 'PARTIALLY_MATCHED', 'MATCHED');
CREATE TYPE "ReconciliationMatchStatus" AS ENUM ('ACTIVE', 'REVERSED');
CREATE TYPE "ReconciliationMatchType" AS ENUM ('MANUAL', 'AUTO');

CREATE TABLE "transaction_imports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_type" "ExternalTransactionSource" NOT NULL,
  "settlement_account_id" UUID NOT NULL,
  "source_file_name" VARCHAR(255) NOT NULL,
  "storage_path" VARCHAR(500) NOT NULL,
  "status" "TransactionImportStatus" NOT NULL DEFAULT 'PENDING',
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "imported_rows" INTEGER NOT NULL DEFAULT 0,
  "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "error_summary" JSONB,
  "imported_by" UUID NOT NULL,
  "imported_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "transaction_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "settlement_account_id" UUID NOT NULL,
  "import_id" UUID,
  "external_reference" VARCHAR(200) NOT NULL,
  "transaction_date" DATE NOT NULL,
  "value_date" DATE,
  "transaction_type" "ExternalTransactionType" NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency_code" CHAR(3) NOT NULL,
  "description" VARCHAR(500),
  "source_type" "ExternalTransactionSource" NOT NULL,
  "reconciliation_status" "ReconciliationStatus" NOT NULL DEFAULT 'UNMATCHED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "external_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_transactions_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "reconciliation_matches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "external_transaction_id" UUID NOT NULL,
  "matched_amount" DECIMAL(19,4) NOT NULL,
  "currency_code" CHAR(3) NOT NULL,
  "status" "ReconciliationMatchStatus" NOT NULL DEFAULT 'ACTIVE',
  "match_type" "ReconciliationMatchType" NOT NULL DEFAULT 'MANUAL',
  "matched_by" UUID NOT NULL,
  "matched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" VARCHAR(500),
  "reversed_by" UUID,
  "reversed_at" TIMESTAMPTZ(6),
  "reversal_reason" VARCHAR(500),
  CONSTRAINT "reconciliation_matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reconciliation_matches_amount_check" CHECK ("matched_amount" > 0)
);

CREATE UNIQUE INDEX "external_transactions_identity_key" ON "external_transactions"("settlement_account_id", "external_reference", "transaction_date", "amount");
CREATE INDEX "transaction_imports_status_created_at_idx" ON "transaction_imports"("status", "created_at");
CREATE INDEX "transaction_imports_settlement_account_id_created_at_idx" ON "transaction_imports"("settlement_account_id", "created_at");
CREATE INDEX "external_transactions_account_currency_status_date_idx" ON "external_transactions"("settlement_account_id", "currency_code", "reconciliation_status", "transaction_date");
CREATE INDEX "external_transactions_import_id_idx" ON "external_transactions"("import_id");
CREATE INDEX "reconciliation_matches_payment_id_status_idx" ON "reconciliation_matches"("payment_id", "status");
CREATE INDEX "reconciliation_matches_external_transaction_id_status_idx" ON "reconciliation_matches"("external_transaction_id", "status");

ALTER TABLE "transaction_imports" ADD CONSTRAINT "transaction_imports_settlement_account_id_fkey" FOREIGN KEY ("settlement_account_id") REFERENCES "settlement_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transaction_imports" ADD CONSTRAINT "transaction_imports_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_transactions" ADD CONSTRAINT "external_transactions_settlement_account_id_fkey" FOREIGN KEY ("settlement_account_id") REFERENCES "settlement_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_transactions" ADD CONSTRAINT "external_transactions_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "transaction_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_transactions" ADD CONSTRAINT "external_transactions_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "claim_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_external_transaction_id_fkey" FOREIGN KEY ("external_transaction_id") REFERENCES "external_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_matched_by_fkey" FOREIGN KEY ("matched_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
