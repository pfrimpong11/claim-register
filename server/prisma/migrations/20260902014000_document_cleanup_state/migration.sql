-- CreateEnum
CREATE TYPE "DocumentCleanupStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "claim_documents"
ADD COLUMN "cleanup_status" "DocumentCleanupStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "cleanup_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cleanup_last_error" VARCHAR(1000),
ADD COLUMN "cleanup_completed_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "claim_documents_cleanup_status_deactivated_at_idx" ON "claim_documents"("cleanup_status", "deactivated_at");

-- AddConstraint
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_cleanup_consistent" CHECK (
  ("cleanup_status" = 'NOT_REQUESTED' AND "status" = 'ACTIVE' AND "cleanup_completed_at" IS NULL)
  OR
  ("cleanup_status" = 'PENDING' AND "status" = 'INACTIVE' AND "cleanup_completed_at" IS NULL)
  OR
  ("cleanup_status" = 'COMPLETED' AND "status" = 'INACTIVE' AND "cleanup_completed_at" IS NOT NULL)
);
