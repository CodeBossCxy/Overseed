-- CreateEnum
CREATE TYPE "CreditBucket" AS ENUM ('SUBSCRIPTION', 'PURCHASED');

-- CreateEnum
CREATE TYPE "CreditLotSource" AS ENUM ('SUBSCRIPTION', 'PACK', 'MIGRATION_BONUS', 'ADMIN');

-- CreateEnum
CREATE TYPE "CreditLedgerType" AS ENUM ('GRANT', 'DEDUCTION', 'REFUND', 'EXPIRY', 'ADMIN_ADJUSTMENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "freePackPurchasedAt" TIMESTAMP(3),
ADD COLUMN     "migrationBonusEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "credit_lots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" "CreditBucket" NOT NULL,
    "source" "CreditLotSource" NOT NULL,
    "credits" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "type" "CreditLedgerType" NOT NULL,
    "bucket" "CreditBucket" NOT NULL,
    "lotId" TEXT,
    "featureKey" TEXT,
    "referenceId" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_config" (
    "tier" "SubscriptionTier" NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "priceAnnual" INTEGER NOT NULL,
    "baseCredits" INTEGER NOT NULL,
    "bonusCredits" INTEGER NOT NULL,
    "migrationBonusPct" INTEGER NOT NULL DEFAULT 25,
    "migrationBonusCycles" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_config_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "credit_pack_config" (
    "id" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "baseCredits" INTEGER NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "freeUserEligible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_pack_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_price_config" (
    "featureKey" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_price_config_pkey" PRIMARY KEY ("featureKey")
);

-- CreateTable
CREATE TABLE "creator_enrichment_cache" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_enrichment_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_lots_reference_key" ON "credit_lots"("reference");

-- CreateIndex
CREATE INDEX "credit_lots_userId_bucket_expiresAt_createdAt_idx" ON "credit_lots"("userId", "bucket", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "credit_ledger_userId_createdAt_idx" ON "credit_ledger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_ledger_userId_referenceId_idx" ON "credit_ledger"("userId", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_enrichment_cache_platform_handle_key" ON "creator_enrichment_cache"("platform", "handle");

-- AddForeignKey
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "credit_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================
-- Seed pricing config (v4 numbers)
-- ===========================================

INSERT INTO "plan_config" ("tier", "priceMonthly", "priceAnnual", "baseCredits", "bonusCredits", "migrationBonusPct", "migrationBonusCycles", "updatedAt") VALUES
  ('FREE',          0,     0,      30,   0,    25, 2, NOW()),
  ('CAMPAIGN_PLUS', 6900,  69000,  400,  200,  25, 2, NOW()),
  ('OUTREACH_PLUS', 10900, 109000, 650,  300,  25, 2, NOW()),
  ('PRO',           19900, 199000, 1200, 600,  25, 2, NOW());

INSERT INTO "credit_pack_config" ("id", "priceCents", "baseCredits", "bonusCredits", "active", "freeUserEligible", "sortOrder", "updatedAt") VALUES
  ('p990',   990,   50,   0,   true, true,  0, NOW()),
  ('p2900',  2900,  180,  20,  true, false, 1, NOW()),
  ('p9900',  9900,  600,  100, true, false, 2, NOW()),
  ('p19900', 19900, 1200, 300, true, false, 3, NOW());

INSERT INTO "credit_price_config" ("featureKey", "credits", "updatedAt") VALUES
  ('chat_standard',    1,  NOW()),
  ('chat_advanced',    3,  NOW()),
  ('image',            4,  NOW()),
  ('discovery_search', 6,  NOW()),
  ('profile_view',     12, NOW()),
  ('outreach',         15, NOW()),
  ('analytics',        48, NOW()),
  ('translation',      0,  NOW()),
  ('doc_export',       0,  NOW());

-- Grandfather: existing paid (non-trial) users get the migration bonus for
-- their first 2 renewal cycles after the v4 cutover.
UPDATE "users" SET "migrationBonusEligible" = true
WHERE "subscriptionTier" IN ('CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO')
  AND "proTrialEndsAt" IS NULL;
