-- Pricing v3 (docs/PRICING_PLAN_V3.md): 4 subscription tiers + AI credit ledger.

-- CreateEnum
CREATE TYPE "CreditTxType" AS ENUM ('PACK_PURCHASE', 'MONTHLY_DEDUCTION', 'PURCHASED_DEDUCTION', 'REFUND', 'ADMIN_ADJUSTMENT');

-- AlterEnum
ALTER TYPE "SubscriptionTier" ADD VALUE 'CAMPAIGN_PLUS';
ALTER TYPE "SubscriptionTier" ADD VALUE 'OUTREACH_PLUS';

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditTxType" NOT NULL,
    "feature" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_transactions_userId_createdAt_idx" ON "credit_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_type_createdAt_idx" ON "credit_transactions"("userId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
