import { hasSupabaseServerConfig } from "../supabase.server";

export const loader = async () => Response.json({
  status: "ok",
  integrations: {
    shopify: Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    supabase: hasSupabaseServerConfig(),
  },
});
