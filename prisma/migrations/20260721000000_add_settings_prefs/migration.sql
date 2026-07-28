-- User appearance + region/notification/privacy preferences.
-- These columns were originally added via `prisma db push`; this migration
-- backfills them into the history so a shadow-database replay stays in sync.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "colorTheme" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "preferredContentLanguage" TEXT,
ADD COLUMN     "timeZone" TEXT,
ADD COLUMN     "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
ADD COLUMN     "displayCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "defaultCampaignCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "profileDiscoverable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowContactSharing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowBusinessContactSharing" BOOLEAN NOT NULL DEFAULT true;
