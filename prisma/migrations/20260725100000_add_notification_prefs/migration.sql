-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "emailCampaignUpdates" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "emailCollaborationUpdates" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "emailPaymentUpdates" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "emailProductUpdates" BOOLEAN NOT NULL DEFAULT true;
