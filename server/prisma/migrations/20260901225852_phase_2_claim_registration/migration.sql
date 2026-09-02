-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('PERSON', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "ReserveType" AS ENUM ('INDEMNITY');

-- CreateEnum
CREATE TYPE "ReserveStatus" AS ENUM ('ACTIVE', 'REPLACED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimFinancialStatus" AS ENUM ('RESERVED_NOT_SETTLED', 'SETTLED_PAYMENT_OUTSTANDING', 'SETTLED_AND_PAID');

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "decimal_places" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" UUID NOT NULL,
    "party_type" "PartyType" NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(50),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "policy_number" VARCHAR(100) NOT NULL,
    "policy_name" VARCHAR(200),
    "insured_party_id" UUID NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "effective_from" DATE,
    "effective_to" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "claim_number" VARCHAR(50) NOT NULL,
    "policy_id" UUID NOT NULL,
    "policy_number_snapshot" VARCHAR(100) NOT NULL,
    "policy_name_snapshot" VARCHAR(200),
    "insured_name_snapshot" VARCHAR(200) NOT NULL,
    "loss_date" DATE NOT NULL,
    "notification_date" DATE NOT NULL,
    "notification_override_reason" VARCHAR(500),
    "loss_nature" VARCHAR(150) NOT NULL,
    "description" VARCHAR(2000),
    "currency_code" CHAR(3) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_reserves" (
    "id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "reserve_type" "ReserveType" NOT NULL DEFAULT 'INDEMNITY',
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "status" "ReserveStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" VARCHAR(500),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "claim_reserves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_status_history" (
    "id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "from_status" "ClaimFinancialStatus",
    "to_status" "ClaimFinancialStatus" NOT NULL,
    "reason" VARCHAR(500),
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_number_sequences" (
    "year" INTEGER NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "claim_number_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE INDEX "parties_display_name_idx" ON "parties"("display_name");

-- CreateIndex
CREATE INDEX "parties_status_party_type_idx" ON "parties"("status", "party_type");

-- CreateIndex
CREATE UNIQUE INDEX "policies_policy_number_key" ON "policies"("policy_number");

-- CreateIndex
CREATE INDEX "policies_insured_party_id_idx" ON "policies"("insured_party_id");

-- CreateIndex
CREATE INDEX "policies_status_currency_code_idx" ON "policies"("status", "currency_code");

-- CreateIndex
CREATE UNIQUE INDEX "claims_claim_number_key" ON "claims"("claim_number");

-- CreateIndex
CREATE INDEX "claims_loss_date_idx" ON "claims"("loss_date");

-- CreateIndex
CREATE INDEX "claims_notification_date_idx" ON "claims"("notification_date");

-- CreateIndex
CREATE INDEX "claims_currency_code_loss_date_idx" ON "claims"("currency_code", "loss_date");

-- CreateIndex
CREATE INDEX "claims_policy_id_idx" ON "claims"("policy_id");

-- CreateIndex
CREATE INDEX "claim_reserves_claim_id_status_reserve_type_idx" ON "claim_reserves"("claim_id", "status", "reserve_type");

-- CreateIndex
CREATE INDEX "claim_status_history_claim_id_changed_at_idx" ON "claim_status_history"("claim_id", "changed_at");

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_insured_party_id_fkey" FOREIGN KEY ("insured_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_reserves" ADD CONSTRAINT "claim_reserves_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_reserves" ADD CONSTRAINT "claim_reserves_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_reserves" ADD CONSTRAINT "claim_reserves_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_status_history" ADD CONSTRAINT "claim_status_history_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_status_history" ADD CONSTRAINT "claim_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
