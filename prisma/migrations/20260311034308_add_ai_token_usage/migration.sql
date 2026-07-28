-- CreateTable
CREATE TABLE "ai_token_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_token_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_token_usage_userId_createdAt_idx" ON "ai_token_usage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_token_usage" ADD CONSTRAINT "ai_token_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
