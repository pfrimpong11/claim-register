CREATE TYPE "ReportExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TABLE "report_exports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_type" VARCHAR(100) NOT NULL,
  "filters" JSONB NOT NULL,
  "status" "ReportExportStatus" NOT NULL DEFAULT 'PENDING',
  "file_path" VARCHAR(500),
  "file_name" VARCHAR(255),
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" VARCHAR(1000),
  "requested_by" UUID NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "report_exports_requested_by_created_at_idx" ON "report_exports"("requested_by", "created_at");
CREATE INDEX "report_exports_status_created_at_idx" ON "report_exports"("status", "created_at");
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
