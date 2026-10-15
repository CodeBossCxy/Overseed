-- Add expiry and rehost-tracking columns to the club search cache
ALTER TABLE "club_search_cache"
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "rehosted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "club_search_cache_expiresAt_idx" ON "club_search_cache"("expiresAt");
