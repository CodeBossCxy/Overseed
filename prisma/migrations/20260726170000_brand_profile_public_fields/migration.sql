-- AlterTable
ALTER TABLE "brand_profiles"
  ADD COLUMN "storeUrl" TEXT,
  ADD COLUMN "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "accountType" TEXT,
  ADD COLUMN "contactJobTitle" TEXT;
