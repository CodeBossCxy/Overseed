-- Pricing v3: monthly-quota consumption events (discovery searches,
-- analytics views, managed outreach).

-- CreateTable
CREATE TABLE "quota_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quota_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quota_usage_userId_kind_createdAt_idx" ON "quota_usage"("userId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "quota_usage" ADD CONSTRAINT "quota_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
