ALTER TABLE "Faq"
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceTitle" TEXT,
  ADD COLUMN "sourceContent" TEXT;

WITH ranked_faqs AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "shop" ORDER BY "createdAt" DESC) AS position
  FROM "Faq"
  WHERE "active" = true
)
UPDATE "Faq"
SET "featured" = true
FROM ranked_faqs
WHERE "Faq"."id" = ranked_faqs."id" AND ranked_faqs.position <= 6;

ALTER TABLE "Conversation"
  ADD COLUMN "customerName" TEXT,
  ADD COLUMN "customerEmail" TEXT;
