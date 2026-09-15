-- CreateEnum
CREATE TYPE "AccountOrigin" AS ENUM ('SEED', 'TEAM', 'EXTERNAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "accountOrigin" "AccountOrigin" NOT NULL DEFAULT 'EXTERNAL';

-- Backfill: everyone that exists at migration time predates public launch → TEAM,
-- except the seed-script demo accounts → SEED. New signups default to EXTERNAL.
UPDATE "users" SET "accountOrigin" = 'TEAM';

UPDATE "users" SET "accountOrigin" = 'SEED'
WHERE "email" IN (
  'brand@glossybeauty.com',
  'brand@techgear.io',
  'brand@fitlifenutrition.com',
  'brand@urbanstyle.co',
  'brand@tastybites.com',
  'influencer@jessicawong.com',
  'influencer@mikefitness.com',
  'influencer@emmastyle.com',
  'influencer@techwithtom.com',
  'influencer@foodiefiona.com',
  'influencer@wanderlust.com'
);
