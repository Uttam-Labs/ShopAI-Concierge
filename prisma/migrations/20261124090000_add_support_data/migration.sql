CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Faq_shop_createdAt_idx" ON "Faq"("shop", "createdAt");

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customer" TEXT,
    "email" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Ticket_reference_key" ON "Ticket"("reference");
CREATE INDEX "Ticket_shop_status_createdAt_idx" ON "Ticket"("shop", "status", "createdAt");

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Conversation_shop_session_key" ON "Conversation"("shop", "session");
CREATE INDEX "Conversation_shop_updatedAt_idx" ON "Conversation"("shop", "updatedAt");

CREATE TABLE "KnowledgeConfig" (
    "shop" TEXT NOT NULL,
    "productIds" JSONB NOT NULL,
    "pageIds" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeConfig_pkey" PRIMARY KEY ("shop")
);

CREATE TABLE "AssistantSettings" (
    "shop" TEXT NOT NULL,
    "recommendations" BOOLEAN NOT NULL DEFAULT true,
    "orderLookup" BOOLEAN NOT NULL DEFAULT true,
    "humanHandoff" BOOLEAN NOT NULL DEFAULT true,
    "faqs" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssistantSettings_pkey" PRIMARY KEY ("shop")
);

CREATE TABLE "OrderLookupAttempt" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderHint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderLookupAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderLookupAttempt_shop_createdAt_idx" ON "OrderLookupAttempt"("shop", "createdAt");
