export const loader = async () => Response.json({
  status: "ok",
  integrations: {
    shopify: Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET),
    openai: Boolean(process.env.OPENAI_API_KEY),
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.DATABASE_URL),
  },
});
