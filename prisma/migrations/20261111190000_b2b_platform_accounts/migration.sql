CREATE TYPE "platform_account_type" AS ENUM ('BUYER', 'SUPPLIER');

CREATE TABLE "platform_accounts" (
  "id" UUID NOT NULL,
  "full_name" TEXT NOT NULL,
  "company_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "account_type" "platform_account_type" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_accounts_email_key" ON "platform_accounts"("email");
CREATE INDEX "platform_accounts_account_type_idx" ON "platform_accounts"("account_type");