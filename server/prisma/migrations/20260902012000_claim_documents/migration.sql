-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CLAIM_FORM', 'POLICE_REPORT', 'ID_DOCUMENT', 'VEHICLE_DOCUMENT', 'LOSS_PHOTO', 'ESTIMATE', 'INVOICE', 'ADJUSTER_REPORT', 'PAYMENT_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'CLOUDINARY');

-- CreateTable
CREATE TABLE "claim_documents" (
    "id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "storage_provider" "StorageProvider" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "cloudinary_asset_id" VARCHAR(255),
    "cloudinary_public_id" VARCHAR(255),
    "cloudinary_version" VARCHAR(100),
    "resource_type" VARCHAR(50),
    "format" VARCHAR(50),
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "provider_metadata" JSONB,
    "description" VARCHAR(500),
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),

    CONSTRAINT "claim_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "claim_documents_file_size_positive" CHECK ("file_size_bytes" > 0),
    CONSTRAINT "claim_documents_deactivation_consistent" CHECK (
      ("status" = 'ACTIVE' AND "deactivated_by" IS NULL AND "deactivated_at" IS NULL)
      OR
      ("status" = 'INACTIVE' AND "deactivated_by" IS NOT NULL AND "deactivated_at" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "claim_documents_storage_key_key" ON "claim_documents"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "claim_documents_cloudinary_asset_id_key" ON "claim_documents"("cloudinary_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_documents_cloudinary_public_id_key" ON "claim_documents"("cloudinary_public_id");

-- CreateIndex
CREATE INDEX "claim_documents_claim_id_status_uploaded_at_idx" ON "claim_documents"("claim_id", "status", "uploaded_at");

-- CreateIndex
CREATE INDEX "claim_documents_uploaded_by_uploaded_at_idx" ON "claim_documents"("uploaded_by", "uploaded_at");

-- AddForeignKey
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_deactivated_by_fkey" FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
