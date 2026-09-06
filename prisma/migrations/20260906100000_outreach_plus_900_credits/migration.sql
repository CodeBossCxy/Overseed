-- Outreach Plus: 950 → 900 credits/mo (600 base + 300 bonus) so the
-- pricing-page "max uses" counts come out round (×300 adv chat, ×225 image,
-- ×150 discovery, ×75 profile, ×60 outreach). Price unchanged (¥109).
UPDATE "plan_config"
SET "baseCredits" = 600, "bonusCredits" = 300, "updatedAt" = NOW()
WHERE "tier" = 'OUTREACH_PLUS';
