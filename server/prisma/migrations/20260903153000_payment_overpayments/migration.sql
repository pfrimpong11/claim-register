ALTER TABLE "claim_payments"
ADD COLUMN "overpayment_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN "overpayment_reason" VARCHAR(500),
ADD COLUMN "overpayment_confirmed_by" UUID,
ADD COLUMN "overpayment_confirmed_at" TIMESTAMPTZ(6);

ALTER TABLE "claim_payments"
ADD CONSTRAINT "claim_payments_overpayment_confirmed_by_fkey"
FOREIGN KEY ("overpayment_confirmed_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "claim_payments"
ADD CONSTRAINT "claim_payments_overpayment_consistency_check"
CHECK (
  ("overpayment_amount" = 0 AND "overpayment_reason" IS NULL AND "overpayment_confirmed_by" IS NULL AND "overpayment_confirmed_at" IS NULL)
  OR
  ("overpayment_amount" > 0 AND "overpayment_reason" IS NOT NULL AND "overpayment_confirmed_by" IS NOT NULL AND "overpayment_confirmed_at" IS NOT NULL)
);

INSERT INTO "gl_accounts" ("id", "code", "name", "account_type", "is_active", "created_at", "updated_at")
VALUES (
  '78d30117-2746-4e7e-b180-30ad0862d2e4',
  'CLAIMS_OVERPAYMENT_RECEIVABLE',
  'Claims Overpayment Receivable',
  'ASSET',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "account_type" = EXCLUDED."account_type", "is_active" = TRUE;
