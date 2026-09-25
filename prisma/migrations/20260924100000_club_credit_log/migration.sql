-- Audit trail of Influencers Club vendor credit spend (one row per billed call)
CREATE TABLE "club_credit_log" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "resultCount" INTEGER,
    "creditsLeft" DECIMAL(10,2),
    "reference" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_credit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "club_credit_log_createdAt_idx" ON "club_credit_log"("createdAt");
