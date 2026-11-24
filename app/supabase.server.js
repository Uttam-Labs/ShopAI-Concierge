import { createClient } from "@supabase/supabase-js";

function isSupabaseServerKey(key) {
  if (!key || key.startsWith("sb_publishable_")) return false;
  // A publishable/anon key cannot call the service-role-only vector search RPC.
  const tokenPayload = key.split(".")[1];
  if (tokenPayload) {
    try {
      if (JSON.parse(Buffer.from(tokenPayload, "base64url").toString("utf8")).role === "anon") return false;
    } catch { /* Non-JWT secret keys are valid on current Supabase projects. */ }
  }
  return true;
}

export function getSupabaseServerKey() {
  return [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].find(isSupabaseServerKey) || "";
}

export function getSupabaseServerUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
}

export function hasSupabaseServerConfig() {
  return getSupabaseServerConfigIssues().length === 0;
}

export function getSupabaseServerConfigIssues() {
  const issues = [];
  if (!getSupabaseServerUrl()) issues.push("SUPABASE_URL");
  const suppliedKeys = [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
  if (!suppliedKeys.length) issues.push("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  else if (!getSupabaseServerKey()) issues.push("a Supabase Secret/service_role key (the publishable/anon key cannot index vectors)");
  if (!process.env.DATABASE_URL) issues.push("DATABASE_URL");
  return issues;
}

export function createSupabaseServerClient() {
  const key = getSupabaseServerKey();
  const url = getSupabaseServerUrl();
  if (!url || !key) throw new Error("Add the Supabase URL and a Secret key or legacy service_role key to the server environment.");
  return createClient(url, key, { auth: { persistSession: false } });
}
