-- Baseline for the payments table + PaymentStatus enum, which were created
-- via `prisma db push` before migration history was repaired and never
-- captured in a migration. Dated just before 20260721000001_add_collaborations
-- (which ALTERs both) so shadow-database replay works. On databases where the
-- table already exists this migration is marked applied via
-- `prisma migrate resolve`.

-- CreateEnum (original pre-collaboration values; add_collaborations extends it)
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'HELD', 'RELEASED', 'REFUNDED', 'FAILED');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "creatorPayout" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeTransferId" TEXT,
    "stripeRefundId" TEXT,
    "paidAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_applicationId_key" ON "payments"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
