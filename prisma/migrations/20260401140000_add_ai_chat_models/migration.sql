-- Backfills the AiChat models that were originally created via `prisma db push`
-- (without a migration), so the later `add_ai_message_feedback` migration has a
-- table to alter when the full history is replayed on a shadow database.

-- CreateTable
CREATE TABLE "ai_chats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_chats_userId_idx" ON "ai_chats"("userId");

-- CreateIndex
CREATE INDEX "ai_chat_messages_chatId_idx" ON "ai_chat_messages"("chatId");

-- AddForeignKey
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "ai_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
