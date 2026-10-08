-- CreateTable
CREATE TABLE "creatordb_credit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "platform" TEXT,
    "searchFilters" JSONB,
    "creditsUsedThis" INTEGER,
    "creditsBefore" INTEGER,
    "creditsAfter" INTEGER,
    "traceId" TEXT,
    "success" BOOLEAN NOT NULL,
    "resultCount" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creatordb_credit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creatordb_credit_log_createdAt_idx" ON "creatordb_credit_log"("createdAt");

-- CreateIndex
CREATE INDEX "creatordb_credit_log_userId_createdAt_idx" ON "creatordb_credit_log"("userId", "createdAt");
