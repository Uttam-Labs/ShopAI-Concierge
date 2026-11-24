import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaClient as LegacyPrismaClient } from "../node_modules/.prisma/legacy-sqlite-client/index.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyDatabase = path.join(projectRoot, "prisma", "dev.sqlite");
const source = new LegacyPrismaClient();
const destination = new PrismaClient();
const models = ["session", "faq", "ticket", "conversation", "knowledgeConfig", "assistantSettings", "orderLookupAttempt"];

try {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to your Supabase Postgres connection string first.");
  try { await fs.access(legacyDatabase); } catch { console.log("No legacy local database to transfer."); process.exit(0); }
  const migration = {};
  for (const model of models) {
    const rows = await source[model].findMany();
    migration[model] = rows.length;
    if (rows.length) await destination[model].createMany({ data: rows, skipDuplicates: true });
  }

  for (const model of models) {
    const count = await destination[model].count();
    if (count < migration[model]) throw new Error(`Data check failed for ${model}; the original database was kept.`);
  }

  await source.$disconnect();
  await destination.$disconnect();
  await fs.rm(legacyDatabase, { force: true });
  await fs.rm(`${legacyDatabase}-journal`, { force: true });
  await fs.rm(`${legacyDatabase}-wal`, { force: true });
  await fs.rm(`${legacyDatabase}-shm`, { force: true });
  console.log(`Transferred app data to Supabase and removed the local database. Records: ${JSON.stringify(migration)}`);
} catch (error) {
  await Promise.allSettled([source.$disconnect(), destination.$disconnect()]);
  console.error("Local-to-Supabase transfer did not finish; the original local database was kept.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
