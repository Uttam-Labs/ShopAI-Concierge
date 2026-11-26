ALTER TABLE "AssistantSettings"
ADD COLUMN "guardrails" JSONB NOT NULL DEFAULT '[]'::jsonb;
