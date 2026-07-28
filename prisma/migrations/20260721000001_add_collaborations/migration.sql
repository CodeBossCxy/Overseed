-- CreateEnum
CREATE TYPE "CollaborationStatus" AS ENUM ('AWAITING_CONFIRMATION', 'ACTIVE', 'SUBMITTED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE 'RELEASE_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'PAYOUT_PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE 'PAID';
ALTER TYPE "PaymentStatus" ADD VALUE 'DISPUTED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "collaborationId" TEXT,
ALTER COLUMN "applicationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "collaborations" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "CollaborationStatus" NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
    "deliverables" TEXT,
    "fee" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "productCompensation" TEXT,
    "deadline" TIMESTAMP(3),
    "revisionRounds" INTEGER NOT NULL DEFAULT 2,
    "revisionsUsed" INTEGER NOT NULL DEFAULT 0,
    "usageRights" TEXT,
    "termsLockedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "publishedPlatform" TEXT,
    "publishedAt" TIMESTAMP(3),
    "evidenceScreenshot" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_deliverables" (
    "id" TEXT NOT NULL,
    "collaborationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileUrl" TEXT,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collaborations_applicationId_key" ON "collaborations"("applicationId");

-- CreateIndex
CREATE INDEX "collaborations_brandId_status_idx" ON "collaborations"("brandId", "status");

-- CreateIndex
CREATE INDEX "collaborations_influencerId_status_idx" ON "collaborations"("influencerId", "status");

-- CreateIndex
CREATE INDEX "collaborations_campaignId_idx" ON "collaborations"("campaignId");

-- CreateIndex
CREATE INDEX "collaboration_deliverables_collaborationId_idx" ON "collaboration_deliverables"("collaborationId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_collaborationId_key" ON "payments"("collaborationId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_deliverables" ADD CONSTRAINT "collaboration_deliverables_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

