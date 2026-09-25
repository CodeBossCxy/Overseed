-- Brand-defined subfolders for organizing saved creators
CREATE TABLE "saved_creator_folders" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_creator_folders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_creator_folders_brandId_name_key" ON "saved_creator_folders"("brandId", "name");

ALTER TABLE "saved_creator_folders" ADD CONSTRAINT "saved_creator_folders_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional folder assignment on saved creators (null = ungrouped)
ALTER TABLE "saved_creators" ADD COLUMN "folderId" TEXT;

CREATE INDEX "saved_creators_folderId_idx" ON "saved_creators"("folderId");

ALTER TABLE "saved_creators" ADD CONSTRAINT "saved_creators_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "saved_creator_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
