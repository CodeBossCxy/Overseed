-- Unified OutreachStatus enum for all outreach types.

-- Create the new enum
CREATE TYPE "OutreachStatus" AS ENUM (
  'SHORTLISTED',
  'SENT',
  'FAILED',
  'AWAITING_RESPONSE',
  'RESPONDED',
  'DECLINED',
  'NEGOTIATING',
  'OFFER_ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

-- Migrate CampaignOutreach.status from free-text String to OutreachStatus enum.
-- First, normalize existing values to the new enum values.
UPDATE "campaign_outreach" SET "status" = 'SHORTLISTED' WHERE "status" IN ('PENDING_REVIEW', 'READY_FOR_OUTREACH', 'SENDING');
UPDATE "campaign_outreach" SET "status" = 'AWAITING_RESPONSE' WHERE "status" IN ('CONTACTED', 'PENDING_RESPONSE');
UPDATE "campaign_outreach" SET "status" = 'RESPONDED' WHERE "status" = 'INTERESTED';
-- SHORTLISTED, SENT, FAILED already match.

-- Convert the column from text to the enum
ALTER TABLE "campaign_outreach"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OutreachStatus" USING "status"::"OutreachStatus",
  ALTER COLUMN "status" SET DEFAULT 'SHORTLISTED';
