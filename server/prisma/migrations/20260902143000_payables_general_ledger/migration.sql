CREATE TYPE "PayableType" AS ENUM ('INDEMNITY', 'ADJUSTER_FEE', 'LEGAL_FEE', 'MEDICAL_FEE', 'OTHER');
CREATE TYPE "PayableStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');
CREATE TYPE "GLAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EXPENSE');
CREATE TYPE "JournalSourceType" AS ENUM ('CLAIM_PAYABLE', 'CLAIM_PAYMENT', 'PAYMENT_REVERSAL');

CREATE TABLE "claim_payables" (
  "id" UUID NOT NULL, "claim_id" UUID NOT NULL,
  "payee_party_id" UUID NOT NULL,
  "payable_type" "PayableType" NOT NULL DEFAULT 'INDEMNITY',
  "amount" DECIMAL(19,4) NOT NULL,
  "currency_code" CHAR(3) NOT NULL,
  "status" "PayableStatus" NOT NULL DEFAULT 'DRAFT',
  "description" VARCHAR(500),
  "created_by" UUID NOT NULL,
  "approved_by" UUID,
  "approved_at" TIMESTAMPTZ(6),
  "cancelled_by" UUID,
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "claim_payables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "claim_payables_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "claim_payables_lifecycle_consistent" CHECK (
    ("status" = 'DRAFT' AND "approved_by" IS NULL AND "approved_at" IS NULL AND "cancelled_by" IS NULL AND "cancelled_at" IS NULL)
    OR ("status" = 'APPROVED' AND "approved_by" IS NOT NULL AND "approved_at" IS NOT NULL AND "cancelled_by" IS NULL AND "cancelled_at" IS NULL)
    OR ("status" = 'CANCELLED' AND "approved_by" IS NULL AND "approved_at" IS NULL AND "cancelled_by" IS NOT NULL AND "cancelled_at" IS NOT NULL)
  )
);

CREATE TABLE "gl_accounts" (
  "id" UUID NOT NULL, "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "account_type" "GLAccountType" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journal_entries" (
  "id" UUID NOT NULL,
  "journal_number" VARCHAR(50) NOT NULL,
  "entry_date" DATE NOT NULL,
  "source_type" "JournalSourceType" NOT NULL,
  "source_id" UUID NOT NULL,
  "claim_id" UUID NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "currency_code" CHAR(3) NOT NULL,
  "posted_by" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journal_lines" (
  "id" UUID NOT NULL,
  "journal_entry_id" UUID NOT NULL,
  "gl_account_id" UUID NOT NULL,
  "claim_id" UUID NOT NULL,
  "party_id" UUID,
  "currency_code" CHAR(3) NOT NULL,
  "debit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "credit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_lines_one_sided" CHECK (
    ("debit_amount" > 0 AND "credit_amount" = 0) OR ("credit_amount" > 0 AND "debit_amount" = 0)
  )
);

CREATE TABLE "journal_number_sequences" ("year" INTEGER NOT NULL, "next_value" INTEGER NOT NULL DEFAULT 1, CONSTRAINT "journal_number_sequences_pkey" PRIMARY KEY ("year"));
CREATE UNIQUE INDEX "gl_accounts_code_key" ON "gl_accounts"("code");
CREATE UNIQUE INDEX "journal_entries_journal_number_key" ON "journal_entries"("journal_number");
CREATE UNIQUE INDEX "journal_entries_source_type_source_id_key" ON "journal_entries"("source_type", "source_id");
CREATE INDEX "claim_payables_claim_id_status_payable_type_idx" ON "claim_payables"("claim_id", "status", "payable_type");
CREATE INDEX "claim_payables_payee_party_id_idx" ON "claim_payables"("payee_party_id");
CREATE INDEX "journal_entries_claim_id_posted_at_idx" ON "journal_entries"("claim_id", "posted_at");
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");
CREATE INDEX "journal_lines_gl_account_id_idx" ON "journal_lines"("gl_account_id");

ALTER TABLE "claim_payables" ADD CONSTRAINT "claim_payables_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payables" ADD CONSTRAINT "claim_payables_payee_party_id_fkey" FOREIGN KEY ("payee_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payables" ADD CONSTRAINT "claim_payables_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payables" ADD CONSTRAINT "claim_payables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_payables" ADD CONSTRAINT "claim_payables_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claim_payables" ADD CONSTRAINT "claim_payables_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
