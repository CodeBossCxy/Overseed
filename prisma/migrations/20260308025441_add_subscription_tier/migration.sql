-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';
