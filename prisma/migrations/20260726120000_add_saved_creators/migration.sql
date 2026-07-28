-- CreateTable
CREATE TABLE "saved_creators" (
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_creators_pkey" PRIMARY KEY ("brandId","influencerId")
);

-- CreateIndex
CREATE INDEX "saved_creators_influencerId_idx" ON "saved_creators"("influencerId");

-- AddForeignKey
ALTER TABLE "saved_creators" ADD CONSTRAINT "saved_creators_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_creators" ADD CONSTRAINT "saved_creators_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
