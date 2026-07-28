-- AlterTable
ALTER TABLE "influencer_profiles" ADD COLUMN "preferredCollabTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
