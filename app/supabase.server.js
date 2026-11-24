import { createClient } from "@supabase/supabase-js";

export function getSupabaseServerKey() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  // A publishable/anon key cannot call the service-role-only vector search RPC.
  return key.startsWith("sb_publishable_") ? "" : key;
}

export function hasSupabaseServerConfig() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseServerKey() && process.env.DATABASE_URL);
}

export function createSupabaseServerClient() {
  const key = getSupabaseServerKey();
  if (!process.env.SUPABASE_URL || !key) throw new Error("Add a Supabase Secret key or legacy service_role key to the server environment.");
  return createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } });
}
