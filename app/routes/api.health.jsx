import { getSupabaseServerConfigIssues, hasSupabaseServerConfig } from "../supabase.server";

export const loader = async () => Response.json({
  status: "ok",
  integrations: {
    shopify: Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET),
    // This only describes the environment-level fallback key. A shop may have
    // a separately encrypted Gemini key saved through Assistant settings.
    geminiEnvironmentKey: Boolean(process.env.GEMINI_API_KEY),
    supabase: hasSupabaseServerConfig(),
    supabaseConfigIssues: getSupabaseServerConfigIssues(),
  },
});
