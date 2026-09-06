-- Managed Outreach merged with Creator Profile View (2026-09-06):
-- same 12-credit "creator unlock" — profile view and/or outreach on the same
-- creator charge once in total. (Overrides the 15-cr margin recommendation
-- by explicit product decision.)
UPDATE "credit_price_config" SET "credits" = 12, "updatedAt" = NOW()
WHERE "featureKey" = 'outreach';
