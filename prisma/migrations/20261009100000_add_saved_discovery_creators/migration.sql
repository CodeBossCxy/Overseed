-- CreateTable
CREATE TABLE "saved_discovery_creators" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "followerCount" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "nicheTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "folderId" TEXT,

    CONSTRAINT "saved_discovery_creators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_discovery_creators_folderId_idx" ON "saved_discovery_creators"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_discovery_creators_brandId_platform_handle_key" ON "saved_discovery_creators"("brandId", "platform", "handle");

-- AddForeignKey
ALTER TABLE "saved_discovery_creators" ADD CONSTRAINT "saved_discovery_creators_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_discovery_creators" ADD CONSTRAINT "saved_discovery_creators_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "saved_creator_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
