CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeDocument_storagePath_key" ON "KnowledgeDocument"("storagePath");
CREATE INDEX "KnowledgeDocument_shop_createdAt_idx" ON "KnowledgeDocument"("shop", "createdAt");
