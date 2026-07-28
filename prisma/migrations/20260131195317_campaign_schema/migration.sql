/*
  Warnings:

  - The values [SHORTLISTED,ACCEPTED] on the enum `ApplicationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `applicantId` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `contactShared` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `portfolio` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `postId` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `logo` on the `brand_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `brand_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `creator_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `posts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shortlists` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[campaignId,influencerId]` on the table `applications` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `campaignId` to the `applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `influencerId` to the `applications` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('INFLUENCER', 'BRAND', 'AGENCY', 'ADMIN');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('PAID', 'GIFTED', 'PAID_PLUS_GIFT', 'AFFILIATE', 'NEGOTIABLE');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('IMAGE_POST', 'VIDEO', 'STORY', 'REEL', 'ANY');

-- AlterEnum
BEGIN;
CREATE TYPE "ApplicationStatus_new" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'COMPLETED');
ALTER TABLE "applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "applications" ALTER COLUMN "status" TYPE "ApplicationStatus_new" USING ("status"::text::"ApplicationStatus_new");
ALTER TYPE "ApplicationStatus" RENAME TO "ApplicationStatus_old";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
DROP TYPE "ApplicationStatus_old";
ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_applicantId_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_postId_fkey";

-- DropForeignKey
ALTER TABLE "creator_profiles" DROP CONSTRAINT "creator_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_authorId_fkey";

-- DropForeignKey
ALTER TABLE "shortlists" DROP CONSTRAINT "shortlists_postId_fkey";

-- DropForeignKey
ALTER TABLE "shortlists" DROP CONSTRAINT "shortlists_userId_fkey";

-- DropIndex
DROP INDEX "applications_applicantId_status_idx";

-- DropIndex
DROP INDEX "applications_postId_applicantId_key";

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "applicantId",
DROP COLUMN "contactShared",
DROP COLUMN "createdAt",
DROP COLUMN "message",
DROP COLUMN "portfolio",
DROP COLUMN "postId",
ADD COLUMN     "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "brandNotes" TEXT,
ADD COLUMN     "campaignId" TEXT NOT NULL,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "influencerId" TEXT NOT NULL,
ADD COLUMN     "pitchMessage" TEXT,
ADD COLUMN     "proposedRate" DECIMAL(10,2),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "socialAccountId" TEXT;

-- AlterTable
ALTER TABLE "brand_profiles" DROP COLUMN "logo",
DROP COLUMN "website",
ADD COLUMN     "companySize" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "verificationDate" TIMESTAMP(3),
ADD COLUMN     "websiteUrl" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userType" "UserType" NOT NULL DEFAULT 'INFLUENCER';

-- DropTable
DROP TABLE "creator_profiles";

-- DropTable
DROP TABLE "posts";

-- DropTable
DROP TABLE "shortlists";

-- DropEnum
DROP TYPE "BudgetType";

-- DropEnum
DROP TYPE "PostStatus";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "iconUrl" TEXT,
    "parentId" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "iconUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalLanguage" TEXT NOT NULL DEFAULT 'en',
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "locationCity" TEXT,
    "locationState" TEXT,
    "locationCountry" TEXT DEFAULT 'USA',
    "primaryNiche" TEXT,
    "secondaryNiches" TEXT[],
    "languages" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_social_accounts" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "platformId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "profileUrl" TEXT,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DECIMAL(5,2),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencer_social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "description" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "agencyId" TEXT,
    "originalLanguage" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "campaignStartDate" TIMESTAMP(3),
    "campaignEndDate" TIMESTAMP(3),
    "totalSlots" INTEGER NOT NULL DEFAULT 10,
    "filledSlots" INTEGER NOT NULL DEFAULT 0,
    "compensationType" "CompensationType" NOT NULL,
    "paymentMin" DECIMAL(10,2),
    "paymentMax" DECIMAL(10,2),
    "giftDescription" TEXT,
    "giftValue" DECIMAL(10,2),
    "requiresProductPurchase" BOOLEAN NOT NULL DEFAULT false,
    "productPurchaseAmount" DECIMAL(10,2),
    "isProductReimbursed" BOOLEAN NOT NULL DEFAULT false,
    "contentType" "ContentType",
    "contentGuidelines" TEXT,
    "wordCountMin" INTEGER,
    "wordCountMax" INTEGER,
    "hashtagsRequired" TEXT,
    "mentionsRequired" TEXT,
    "images" TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_platforms" (
    "campaignId" TEXT NOT NULL,
    "platformId" INTEGER NOT NULL,

    CONSTRAINT "campaign_platforms_pkey" PRIMARY KEY ("campaignId","platformId")
);

-- CreateTable
CREATE TABLE "campaign_categories" (
    "campaignId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "campaign_categories_pkey" PRIMARY KEY ("campaignId","categoryId")
);

-- CreateTable
CREATE TABLE "campaign_follower_requirements" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platformId" INTEGER NOT NULL,
    "minFollowers" INTEGER NOT NULL DEFAULT 0,
    "maxFollowers" INTEGER,
    "minEngagementRate" DECIMAL(5,2),

    CONSTRAINT "campaign_follower_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_media" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_campaigns" (
    "influencerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_campaigns_pkey" PRIMARY KEY ("influencerId","campaignId")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "influencer_profiles_userId_key" ON "influencer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "influencer_social_accounts_influencerId_platformId_key" ON "influencer_social_accounts"("influencerId", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "agency_profiles_userId_key" ON "agency_profiles"("userId");

-- CreateIndex
CREATE INDEX "campaigns_status_createdAt_idx" ON "campaigns"("status", "createdAt");

-- CreateIndex
CREATE INDEX "campaigns_brandId_idx" ON "campaigns"("brandId");

-- CreateIndex
CREATE INDEX "campaigns_deadline_idx" ON "campaigns"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_follower_requirements_campaignId_platformId_key" ON "campaign_follower_requirements"("campaignId", "platformId");

-- CreateIndex
CREATE INDEX "applications_influencerId_status_idx" ON "applications"("influencerId", "status");

-- CreateIndex
CREATE INDEX "applications_campaignId_status_idx" ON "applications"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_campaignId_influencerId_key" ON "applications"("campaignId", "influencerId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_profiles" ADD CONSTRAINT "influencer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_social_accounts" ADD CONSTRAINT "influencer_social_accounts_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_social_accounts" ADD CONSTRAINT "influencer_social_accounts_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_profiles" ADD CONSTRAINT "agency_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_platforms" ADD CONSTRAINT "campaign_platforms_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_platforms" ADD CONSTRAINT "campaign_platforms_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_categories" ADD CONSTRAINT "campaign_categories_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_categories" ADD CONSTRAINT "campaign_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_follower_requirements" ADD CONSTRAINT "campaign_follower_requirements_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_follower_requirements" ADD CONSTRAINT "campaign_follower_requirements_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_media" ADD CONSTRAINT "campaign_media_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "influencer_social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_campaigns" ADD CONSTRAINT "saved_campaigns_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_campaigns" ADD CONSTRAINT "saved_campaigns_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
