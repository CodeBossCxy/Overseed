-- CreateEnum
CREATE TYPE "BrandVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "brand_profiles" ADD COLUMN "brandVerificationStatus" "BrandVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3),
ADD COLUMN "verificationReviewedAt" TIMESTAMP(3),
ADD COLUMN "verificationReviewedBy" TEXT,
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "businessLegalName" TEXT,
ADD COLUMN "businessRegistrationNo" TEXT,
ADD COLUMN "businessCountry" TEXT,
ADD COLUMN "businessWebsite" TEXT,
ADD COLUMN "businessDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[];
