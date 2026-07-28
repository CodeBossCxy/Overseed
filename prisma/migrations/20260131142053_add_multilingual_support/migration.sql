-- AlterTable
ALTER TABLE "brand_profiles" ADD COLUMN     "originalLanguage" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "creator_profiles" ADD COLUMN     "originalLanguage" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "originalLanguage" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isAutoTranslated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "translations_entityType_entityId_idx" ON "translations"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "translations_languageCode_idx" ON "translations"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "translations_entityType_entityId_fieldName_languageCode_key" ON "translations"("entityType", "entityId", "fieldName", "languageCode");
