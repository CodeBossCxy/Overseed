-- Store the normalized request alongside each permanent search response so
-- cache exports can show which query and filters produced the results.
ALTER TABLE "club_search_cache"
ADD COLUMN "request" JSONB;
