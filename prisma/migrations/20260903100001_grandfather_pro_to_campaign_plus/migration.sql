-- Pricing v3 migration path: existing PRO subscribers (old ¥69.99 plan,
-- including verified-trial users) map to CAMPAIGN_PLUS (¥69). The new PRO
-- tier is the ¥199 plan. Kept as a separate migration because Postgres
-- cannot use enum values added in the same transaction.
UPDATE "users" SET "subscriptionTier" = 'CAMPAIGN_PLUS' WHERE "subscriptionTier" = 'PRO';
