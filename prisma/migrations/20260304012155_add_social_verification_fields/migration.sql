-- AlterTable
ALTER TABLE "influencer_social_accounts" ADD COLUMN     "likesCount" INTEGER,
ADD COLUMN     "screenshotUrl" TEXT,
ADD COLUMN     "verificationMethod" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
