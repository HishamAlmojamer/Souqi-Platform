-- CreateEnum
CREATE TYPE "message_thread_type" AS ENUM ('PRODUCT', 'RFQ', 'QUOTE', 'PURCHASE_ORDER', 'SAMPLE', 'INSPECTION', 'ESCROW', 'SHIPMENT', 'SUPPORT');

-- CreateEnum
CREATE TYPE "message_thread_status" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "rfq_attachments" (
    "id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "uploaded_by_account_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "classification" TEXT NOT NULL,
    "confidentiality" TEXT NOT NULL DEFAULT 'INVITED_SUPPLIERS',
    "scan_status" "scan_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_threads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "message_thread_type" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "message_thread_status" NOT NULL DEFAULT 'OPEN',
    "rfq_id" UUID,
    "quote_id" UUID,
    "purchase_order_id" UUID,
    "sample_id" UUID,
    "inspection_report_id" UUID,
    "escrow_hold_id" UUID,
    "shipment_id" UUID,
    "participant_org_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "sender_account_id" UUID NOT NULL,
    "sender_org_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "offer_json" JSONB,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reads" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "message_id" UUID,
    "account_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rfq_attachments_rfq_id_created_at_idx" ON "rfq_attachments"("rfq_id", "created_at");
CREATE INDEX "message_threads_organization_id_status_last_message_at_idx" ON "message_threads"("organization_id", "status", "last_message_at");
CREATE INDEX "message_threads_rfq_id_idx" ON "message_threads"("rfq_id");
CREATE INDEX "message_threads_purchase_order_id_idx" ON "message_threads"("purchase_order_id");
CREATE UNIQUE INDEX "messages_thread_id_idempotency_key_key" ON "messages"("thread_id", "idempotency_key");
CREATE INDEX "messages_thread_id_created_at_idx" ON "messages"("thread_id", "created_at");
CREATE UNIQUE INDEX "message_reads_thread_id_account_id_key" ON "message_reads"("thread_id", "account_id");

-- AddForeignKey
ALTER TABLE "rfq_attachments" ADD CONSTRAINT "rfq_attachments_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfq_attachments" ADD CONSTRAINT "rfq_attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rfq_attachments" ADD CONSTRAINT "rfq_attachments_uploaded_by_account_id_fkey" FOREIGN KEY ("uploaded_by_account_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_account_id_fkey" FOREIGN KEY ("sender_account_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_org_id_fkey" FOREIGN KEY ("sender_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
