-- AlterEnum
ALTER TYPE "verification_status" ADD VALUE IF NOT EXISTS 'UNVERIFIED' BEFORE 'DRAFT';
ALTER TYPE "verification_status" ADD VALUE IF NOT EXISTS 'PENDING_AUDIT' AFTER 'IN_REVIEW';
ALTER TYPE "verification_status" ADD VALUE IF NOT EXISTS 'AUDITED_SUPPLIER' AFTER 'APPROVED';

-- AlterEnum
ALTER TYPE "sample_status" ADD VALUE IF NOT EXISTS 'QUOTED' AFTER 'REQUESTED';
ALTER TYPE "sample_status" ADD VALUE IF NOT EXISTS 'PAID' AFTER 'QUOTED';
ALTER TYPE "sample_status" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION' AFTER 'PAID';
ALTER TYPE "sample_status" ADD VALUE IF NOT EXISTS 'DELIVERED' AFTER 'SHIPPED';
ALTER TYPE "sample_status" ADD VALUE IF NOT EXISTS 'REVISION_NEEDED' AFTER 'REVISION_REQUESTED';

-- AlterEnum
ALTER TYPE "milestone_status" ADD VALUE IF NOT EXISTS 'RAW_MATERIALS_READY' AFTER 'PENDING';
ALTER TYPE "milestone_status" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION' AFTER 'RAW_MATERIALS_READY';
ALTER TYPE "milestone_status" ADD VALUE IF NOT EXISTS 'QUALITY_CHECK' AFTER 'IN_PRODUCTION';
ALTER TYPE "milestone_status" ADD VALUE IF NOT EXISTS 'PACKAGING' AFTER 'QUALITY_CHECK';
ALTER TYPE "milestone_status" ADD VALUE IF NOT EXISTS 'READY_TO_SHIP' AFTER 'PACKAGING';

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "product_source" AS ENUM ('CATALOG', 'CUSTOM', 'RFQ');

-- CreateEnum
CREATE TYPE "inspection_kind" AS ENUM ('FACTORY_AUDIT', 'PRE_SHIPMENT', 'SAMPLE', 'LABORATORY', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "inspection_report_status" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "rfqs" ADD COLUMN     "category" TEXT,
ADD COLUMN     "target_unit_price_cents" BIGINT,
ADD COLUMN     "incoterm" TEXT,
ADD COLUMN     "branding_requirements" TEXT;

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "supplier_org_id" UUID NOT NULL,
    "industry_id" UUID NOT NULL,
    "created_by_account_id" UUID NOT NULL,
    "sku" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" "product_source" NOT NULL DEFAULT 'CATALOG',
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "specifications" JSONB NOT NULL,
    "unit" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "min_order_quantity" INTEGER,
    "lead_time_days" INTEGER,
    "production_capacity" INTEGER,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_cents" BIGINT,
    "country_code" CHAR(2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "inspection_kind" NOT NULL,
    "status" "inspection_report_status" NOT NULL DEFAULT 'DRAFT',
    "issuer" TEXT NOT NULL,
    "report_number" TEXT,
    "object_key" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "scope" TEXT,
    "summary" JSONB,
    "score" INTEGER,
    "issued_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "verified_by_account_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inspection_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_supplier_org_id_status_idx" ON "products"("supplier_org_id", "status");
CREATE INDEX "products_industry_id_status_idx" ON "products"("industry_id", "status");
CREATE INDEX "products_category_idx" ON "products"("category");
CREATE INDEX "product_media_product_id_sort_order_idx" ON "product_media"("product_id", "sort_order");
CREATE INDEX "inspection_reports_organization_id_status_idx" ON "inspection_reports"("organization_id", "status");
CREATE INDEX "inspection_reports_kind_status_idx" ON "inspection_reports"("kind", "status");
CREATE INDEX "inspection_reports_expires_at_idx" ON "inspection_reports"("expires_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_org_id_fkey" FOREIGN KEY ("supplier_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_verified_by_account_id_fkey" FOREIGN KEY ("verified_by_account_id") REFERENCES "platform_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
