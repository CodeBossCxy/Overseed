-- Pricing v4.1 (2026-09-06):
-- 1. Limited-time discount display: compareAtMonthly (strikethrough original
--    price). Growth Plus shows ~~¥159~~ ¥109, Pro ~~¥259~~ ¥199.
-- 2. Campaign Plus credits: 600 -> 450/mo (300 base + 150 bonus).
-- 3. Analytics price 48 -> 45 cr (round plan max-uses: 10/20/40; margin
--    reviewed — reprice to 50 if CNY/USD nears 8.0).
ALTER TABLE "plan_config" ADD COLUMN "compareAtMonthly" INTEGER NOT NULL DEFAULT 0;

UPDATE "plan_config" SET "baseCredits" = 300, "bonusCredits" = 150, "updatedAt" = NOW()
WHERE "tier" = 'CAMPAIGN_PLUS';

UPDATE "plan_config" SET "compareAtMonthly" = 15900, "updatedAt" = NOW()
WHERE "tier" = 'OUTREACH_PLUS';

UPDATE "plan_config" SET "compareAtMonthly" = 25900, "updatedAt" = NOW()
WHERE "tier" = 'PRO';

UPDATE "credit_price_config" SET "credits" = 45, "updatedAt" = NOW()
WHERE "featureKey" = 'analytics';
