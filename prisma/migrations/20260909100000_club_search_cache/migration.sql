-- Short-TTL cache of club discovery search responses
CREATE TABLE "club_search_cache" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_search_cache_pkey" PRIMARY KEY ("key")
);
