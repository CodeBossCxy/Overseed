-- Divide all credit costs by 3 (round up) to match 3x credit value increase.

-- Feature prices
UPDATE "credit_price_config" SET "credits" = 1,  "updatedAt" = NOW() WHERE "featureKey" = 'chat_standard';
UPDATE "credit_price_config" SET "credits" = 1,  "updatedAt" = NOW() WHERE "featureKey" = 'chat_advanced';
UPDATE "credit_price_config" SET "credits" = 2,  "updatedAt" = NOW() WHERE "featureKey" = 'image';
UPDATE "credit_price_config" SET "credits" = 2,  "updatedAt" = NOW() WHERE "featureKey" = 'discovery_search';
UPDATE "credit_price_config" SET "credits" = 4,  "updatedAt" = NOW() WHERE "featureKey" = 'profile_view';
UPDATE "credit_price_config" SET "credits" = 4,  "updatedAt" = NOW() WHERE "featureKey" = 'outreach';
UPDATE "credit_price_config" SET "credits" = 15, "updatedAt" = NOW() WHERE "featureKey" = 'analytics';

-- Plan credits (base and bonus)
UPDATE "plan_config" SET "baseCredits" = 10,  "bonusCredits" = 0,   "updatedAt" = NOW() WHERE "tier" = 'FREE';
UPDATE "plan_config" SET "baseCredits" = 100, "bonusCredits" = 50,  "updatedAt" = NOW() WHERE "tier" = 'CAMPAIGN_PLUS';
UPDATE "plan_config" SET "baseCredits" = 200, "bonusCredits" = 100, "updatedAt" = NOW() WHERE "tier" = 'OUTREACH_PLUS';
UPDATE "plan_config" SET "baseCredits" = 400, "bonusCredits" = 200, "updatedAt" = NOW() WHERE "tier" = 'PRO';

-- Credit pack configs
UPDATE "credit_pack_config" SET "baseCredits" = 17,  "bonusCredits" = 0,   "updatedAt" = NOW() WHERE "id" = 'p990';
UPDATE "credit_pack_config" SET "baseCredits" = 60,  "bonusCredits" = 7,   "updatedAt" = NOW() WHERE "id" = 'p2900';
UPDATE "credit_pack_config" SET "baseCredits" = 200, "bonusCredits" = 34,  "updatedAt" = NOW() WHERE "id" = 'p9900';
UPDATE "credit_pack_config" SET "baseCredits" = 400, "bonusCredits" = 100, "updatedAt" = NOW() WHERE "id" = 'p19900';
