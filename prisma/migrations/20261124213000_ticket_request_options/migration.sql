ALTER TABLE "AssistantSettings"
  ADD COLUMN "ticketPrefix" TEXT NOT NULL DEFAULT 'SAC',
  ADD COLUMN "ticketOptions" JSONB NOT NULL DEFAULT '[]'::jsonb;
