ALTER TABLE "AssistantSettings"
ADD COLUMN "flows" JSONB NOT NULL DEFAULT '[]'::jsonb;
