ALTER TABLE "AssistantSettings"
  ADD COLUMN "aiProvider" TEXT NOT NULL DEFAULT 'gemini',
  ADD COLUMN "aiApiKeyEncrypted" TEXT;
