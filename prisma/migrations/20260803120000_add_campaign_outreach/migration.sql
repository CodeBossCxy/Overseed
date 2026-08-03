CREATE TABLE "campaign_outreach" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "externalCreatorId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "followerCount" INTEGER,
    "engagementRate" DECIMAL(7,3),
    "country" TEXT,
    "nicheTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'SHORTLISTED',
    "requestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_outreach_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_outreach_campaignId_externalCreatorId_key" ON "campaign_outreach"("campaignId", "externalCreatorId");
CREATE INDEX "campaign_outreach_campaignId_status_idx" ON "campaign_outreach"("campaignId", "status");
ALTER TABLE "campaign_outreach" ADD CONSTRAINT "campaign_outreach_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
