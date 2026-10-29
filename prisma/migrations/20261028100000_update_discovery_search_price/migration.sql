-- Update discovery_search price from 2 to 4 credits per page
UPDATE "credit_price_config" SET "credits" = 4, "updatedAt" = NOW() WHERE "featureKey" = 'discovery_search';
