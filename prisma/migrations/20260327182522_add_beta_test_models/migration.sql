-- CreateTable
CREATE TABLE "beta_invite_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "beta_invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_invite_usage" (
    "id" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_invite_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "page" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beta_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beta_invite_codes_code_key" ON "beta_invite_codes"("code");

-- CreateIndex
CREATE INDEX "beta_invite_codes_code_idx" ON "beta_invite_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "beta_invite_usage_inviteCodeId_userId_key" ON "beta_invite_usage"("inviteCodeId", "userId");

-- CreateIndex
CREATE INDEX "beta_feedback_userId_idx" ON "beta_feedback"("userId");

-- CreateIndex
CREATE INDEX "beta_feedback_status_idx" ON "beta_feedback"("status");

-- AddForeignKey
ALTER TABLE "beta_invite_usage" ADD CONSTRAINT "beta_invite_usage_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "beta_invite_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
