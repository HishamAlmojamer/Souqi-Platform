-- CreateEnum
CREATE TYPE "escrow_hold_status" AS ENUM ('AWAITING_PAYMENT', 'FUNDS_HELD_IN_ESCROW', 'PARTIAL_RELEASED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "escrow_condition_kind" AS ENUM ('PRODUCTION_STARTED', 'SAMPLE_APPROVED', 'INSPECTION_APPROVED', 'MILESTONE_DONE', 'SHIPMENT_DELIVERED', 'DOCUMENT_APPROVED', 'MANUAL');

-- CreateEnum
CREATE TYPE "escrow_condition_status" AS ENUM ('PENDING', 'MET', 'WAIVED');

-- CreateEnum
CREATE TYPE "escrow_ledger_entry_type" AS ENUM ('HOLD_CREATED', 'CONDITION_MET', 'PARTIAL_RELEASED', 'RELEASED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('CREATED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION');

-- CreateTable
CREATE TABLE "escrow_holds" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "buyer_org_id" UUID NOT NULL,
    "supplier_org_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "escrow_hold_status" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "mode" TEXT NOT NULL DEFAULT 'DEMO',
    "idempotency_key" TEXT NOT NULL,
    "created_by_account_id" UUID NOT NULL,
    "funded_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "escrow_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_conditions" (
    "id" UUID NOT NULL,
    "escrow_hold_id" UUID NOT NULL,
    "kind" "escrow_condition_kind" NOT NULL,
    "status" "escrow_condition_status" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "percentage" INTEGER NOT NULL,
    "target_resource_id" UUID,
    "met_at" TIMESTAMPTZ(6),
    "met_by_account_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "escrow_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_ledger_entries" (
    "id" UUID NOT NULL,
    "escrow_hold_id" UUID NOT NULL,
    "type" "escrow_ledger_entry_type" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "balance_after_cents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB,
    "actor_account_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_account_id" UUID NOT NULL,
    "carrier" TEXT,
    "tracking_number" TEXT,
    "status" "shipment_status" NOT NULL DEFAULT 'CREATED',
    "origin" TEXT,
    "destination" TEXT,
    "document_object_key" TEXT,
    "shipped_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL,
    "location" TEXT,
    "note" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "organization_id" UUID,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "dedupe_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escrow_holds_purchase_order_id_key" ON "escrow_holds"("purchase_order_id");
CREATE UNIQUE INDEX "escrow_holds_idempotency_key_key" ON "escrow_holds"("idempotency_key");
CREATE INDEX "escrow_holds_buyer_org_id_status_idx" ON "escrow_holds"("buyer_org_id", "status");
CREATE INDEX "escrow_holds_supplier_org_id_status_idx" ON "escrow_holds"("supplier_org_id", "status");
CREATE INDEX "escrow_conditions_escrow_hold_id_status_idx" ON "escrow_conditions"("escrow_hold_id", "status");
CREATE UNIQUE INDEX "escrow_ledger_entries_idempotency_key_key" ON "escrow_ledger_entries"("idempotency_key");
CREATE INDEX "escrow_ledger_entries_escrow_hold_id_created_at_idx" ON "escrow_ledger_entries"("escrow_hold_id", "created_at");
CREATE INDEX "shipments_purchase_order_id_idx" ON "shipments"("purchase_order_id");
CREATE INDEX "shipments_tracking_number_idx" ON "shipments"("tracking_number");
CREATE INDEX "shipments_status_idx" ON "shipments"("status");
CREATE UNIQUE INDEX "shipment_events_idempotency_key_key" ON "shipment_events"("idempotency_key");
CREATE INDEX "shipment_events_shipment_id_occurred_at_idx" ON "shipment_events"("shipment_id", "occurred_at");
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX "notifications_account_id_read_at_created_at_idx" ON "notifications"("account_id", "read_at", "created_at");
CREATE INDEX "notifications_organization_id_created_at_idx" ON "notifications"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_supplier_org_id_fkey" FOREIGN KEY ("supplier_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_conditions" ADD CONSTRAINT "escrow_conditions_escrow_hold_id_fkey" FOREIGN KEY ("escrow_hold_id") REFERENCES "escrow_holds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escrow_conditions" ADD CONSTRAINT "escrow_conditions_met_by_account_id_fkey" FOREIGN KEY ("met_by_account_id") REFERENCES "platform_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "escrow_ledger_entries" ADD CONSTRAINT "escrow_ledger_entries_escrow_hold_id_fkey" FOREIGN KEY ("escrow_hold_id") REFERENCES "escrow_holds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_ledger_entries" ADD CONSTRAINT "escrow_ledger_entries_actor_account_id_fkey" FOREIGN KEY ("actor_account_id") REFERENCES "platform_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
