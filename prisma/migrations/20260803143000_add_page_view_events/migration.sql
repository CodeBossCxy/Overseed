CREATE TABLE "page_view_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_view_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_view_events_path_createdAt_idx" ON "page_view_events"("path", "createdAt");
CREATE INDEX "page_view_events_userId_createdAt_idx" ON "page_view_events"("userId", "createdAt");
