-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CampaignObjective" AS ENUM ('BRAND_AWARENESS', 'PRODUCT_LAUNCH', 'SALES_CONVERSION', 'UGC_CREATION', 'PRODUCT_REVIEWS', 'COMMUNITY_ENGAGEMENT', 'MARKET_TESTING', 'BRAND_AMBASSADOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Campaign Objective & Targeting
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "campaignObjective" "CampaignObjective";
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "targetCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "targetLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "targetAudienceAge" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "targetAudienceGender" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "productUrl" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "brandPositioning" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "contentStyles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: Creator Preferences
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "creatorTierPreference" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "creatorTypePreference" TEXT;

-- AlterTable: Budget
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "budgetPerCreator" DECIMAL(10, 2);
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "totalBudget" DECIMAL(10, 2);
