-- Add structured verification submission storage
ALTER TABLE "brand_profiles" ADD COLUMN "verificationData" JSONB;
