-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "contentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: copy existing contentType into contentTypes array
UPDATE "campaigns" SET "contentTypes" = ARRAY["contentType"::TEXT] WHERE "contentType" IS NOT NULL AND array_length("contentTypes", 1) IS NULL;
