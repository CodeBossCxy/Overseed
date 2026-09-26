-- CreateEnum
CREATE TYPE "OutreachCampaignStatus" AS ENUM ('DRAFT', 'SELECTING', 'READY', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutreachRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "creator_profiles" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "email" TEXT,
    "followerCount" INTEGER,
    "engagementRate" DECIMAL(7,3),
    "country" TEXT,
    "language" TEXT,
    "nicheTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audienceDemographics" JSONB,
    "contentCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avgViews" INTEGER,
    "avgLikes" INTEGER,
    "lastContactedAt" TIMESTAMP(3),
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_campaigns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "briefMessage" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "criteria" JSONB,
    "status" "OutreachCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "creditsCost" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_recipients" (
    "id" TEXT NOT NULL,
    "outreachCampaignId" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "followerCount" INTEGER,
    "engagementRate" DECIMAL(7,3),
    "matchScore" DECIMAL(5,2),
    "matchReason" TEXT,
    "status" "OutreachRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_recipients_pkey" PRIMARY KEY ("id")
);

-- AlterTable: make Conversation.applicationId optional, add outreachRecipientId
ALTER TABLE "conversations" ALTER COLUMN "applicationId" DROP NOT NULL;

ALTER TABLE "conversations" ADD COLUMN "outreachRecipientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_platform_handle_key" ON "creator_profiles"("platform", "handle");
CREATE INDEX "creator_profiles_platform_country_idx" ON "creator_profiles"("platform", "country");
CREATE INDEX "creator_profiles_lastContactedAt_idx" ON "creator_profiles"("lastContactedAt");

CREATE INDEX "outreach_campaigns_userId_createdAt_idx" ON "outreach_campaigns"("userId", "createdAt");
CREATE INDEX "outreach_campaigns_brandId_status_idx" ON "outreach_campaigns"("brandId", "status");

CREATE UNIQUE INDEX "outreach_recipients_outreachCampaignId_handle_key" ON "outreach_recipients"("outreachCampaignId", "handle");
CREATE INDEX "outreach_recipients_outreachCampaignId_status_idx" ON "outreach_recipients"("outreachCampaignId", "status");

CREATE UNIQUE INDEX "conversations_outreachRecipientId_key" ON "conversations"("outreachRecipientId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_outreachRecipientId_fkey" FOREIGN KEY ("outreachRecipientId") REFERENCES "outreach_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outreach_recipients" ADD CONSTRAINT "outreach_recipients_outreachCampaignId_fkey" FOREIGN KEY ("outreachCampaignId") REFERENCES "outreach_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outreach_recipients" ADD CONSTRAINT "outreach_recipients_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "creator_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
