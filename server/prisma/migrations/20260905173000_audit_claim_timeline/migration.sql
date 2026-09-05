ALTER TABLE "audit_logs" ADD COLUMN "claim_id" UUID;

CREATE INDEX "audit_logs_claim_id_occurred_at_idx"
ON "audit_logs"("claim_id", "occurred_at");

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_claim_id_fkey"
FOREIGN KEY ("claim_id") REFERENCES "claims"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
