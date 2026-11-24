ALTER TABLE "KnowledgeConfig" ADD COLUMN "collectionIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "KnowledgeConfig" ADD COLUMN "policyIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "KnowledgeConfig" ADD COLUMN "customSources" JSONB NOT NULL DEFAULT '[]'::jsonb;
