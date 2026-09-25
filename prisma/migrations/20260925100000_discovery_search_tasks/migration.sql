-- Creator discovery search tasks: one row per search submission, with
-- per-page result snapshots (a stored page = already paid, free to re-view)
CREATE TABLE "discovery_search_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_search_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discovery_search_tasks_userId_updatedAt_idx" ON "discovery_search_tasks"("userId", "updatedAt");

ALTER TABLE "discovery_search_tasks" ADD CONSTRAINT "discovery_search_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "discovery_task_pages" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_task_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discovery_task_pages_taskId_page_key" ON "discovery_task_pages"("taskId", "page");

ALTER TABLE "discovery_task_pages" ADD CONSTRAINT "discovery_task_pages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "discovery_search_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
