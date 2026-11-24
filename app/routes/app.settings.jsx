import { useFetcher, useNavigate } from "react-router";
import { useRef, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import { useActionToast } from "../components/AdminToast";
import { normalizeTicketPrefix } from "../support.server";
import { hasGeminiKey } from "../gemini.server";
import { AI_PROVIDERS, encryptProviderKey, providerKeyError, resolveProviderKey, verifyProviderKey } from "../ai.server";
import { hasSupabaseServerConfig } from "../supabase.server";

const defaults = {
  aiProvider: "gemini",
  recommendations: true,
  orderLookup: true,
  orderEmailRequired: true,
  humanHandoff: true,
  faqs: true,
  defaultGreeting: "Hi there! 👋 Tell me what you’re shopping for, ask about our policies, or track an order.",
  responseGuidelines: "Be concise, helpful, and on-brand. Use only approved store information. Never invent products, stock, policies, tracking details, or discounts.",
  ticketPrefix: "SAC",
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const prisma = (await import("../db.server.js")).default;
  const row = await prisma.assistantSettings.findUnique({ where: { shop: session.shop } });
  const aiProvider = AI_PROVIDERS.includes(row?.aiProvider) ? row.aiProvider : "gemini";
  const aiConnected = Boolean(resolveProviderKey(row || { aiProvider }));
  const settings = { ...defaults, ...(row || {}), aiProvider };
  delete settings.aiApiKeyEncrypted;
  return { settings, connections: { ai: aiConnected, aiProvider, embeddings: Boolean(hasGeminiKey() || (aiProvider === "gemini" && aiConnected)), supabase: hasSupabaseServerConfig() } };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const previous = await (await import("../db.server.js")).default.assistantSettings.findUnique({ where: { shop: session.shop }, select: { aiProvider: true, aiApiKeyEncrypted: true } });
  const aiProvider = String(form.get("aiProvider") || previous?.aiProvider || "gemini");
  if (!AI_PROVIDERS.includes(aiProvider)) return { error: "Choose OpenAI, Gemini, or Anthropic." };
  const submittedApiKey = String(form.get("aiApiKey") || "").trim();
  const providerChanged = Boolean(previous && previous.aiProvider !== aiProvider);
  let aiApiKeyEncrypted = previous?.aiApiKeyEncrypted || null;
  if (submittedApiKey) {
    if (submittedApiKey.length > 1000) return { error: "The API key is too long. Please check the copied value." };
    try {
      await verifyProviderKey(aiProvider, submittedApiKey);
      aiApiKeyEncrypted = encryptProviderKey(submittedApiKey);
    } catch (error) {
      console.error("AI provider connection test failed", { provider: aiProvider, message: error?.message });
      return { error: providerKeyError(error, aiProvider) };
    }
  } else if (providerChanged) {
    return { error: `Enter a ${aiProvider} API key to switch providers. The key is tested before it is saved.` };
  } else if (!aiApiKeyEncrypted && aiProvider !== "gemini") {
    return { error: `Enter a ${aiProvider} API key to connect the assistant.` };
  } else if (!aiApiKeyEncrypted && aiProvider === "gemini" && !process.env.GEMINI_API_KEY) {
    return { error: "Enter a Gemini API key to connect the assistant." };
  }
  if (!submittedApiKey && previous?.aiApiKeyEncrypted && previous.aiProvider !== aiProvider) {
    return { error: `Enter a new ${aiProvider} API key to connect this provider.` };
  }
  const values = {
    aiProvider,
    aiApiKeyEncrypted,
    recommendations: form.get("recommendations") === "on",
    orderLookup: form.get("orderLookup") === "on",
    orderEmailRequired: form.get("orderEmailRequired") === "on",
    humanHandoff: form.get("humanHandoff") === "on",
    faqs: form.get("faqs") === "on",
    defaultGreeting: String(form.get("defaultGreeting") || defaults.defaultGreeting).trim().slice(0, 280),
    responseGuidelines: String(form.get("responseGuidelines") || defaults.responseGuidelines).trim().slice(0, 2000),
    ticketPrefix: normalizeTicketPrefix(form.get("ticketPrefix")),
  };
  const prisma = (await import("../db.server.js")).default;
  try {
    await prisma.assistantSettings.upsert({ where: { shop: session.shop }, create: { shop: session.shop, ...values }, update: values });
    return { saved: true, aiProvider };
  } catch (error) {
    console.error("Assistant settings save failed", error);
    return { error: "We couldn’t save assistant settings. Please try again." };
  }
};

const features = [
  ["recommendations", "Product recommendations", "Show up to four relevant products when the store catalog matches a shopper’s request.", "book"],
  ["orderLookup", "Order tracking", "Let customers securely check fulfillment status using their order number and checkout email.", "list"],
  ["humanHandoff", "Customer support requests", "Let shoppers submit a structured request to your support team.", "chat"],
  ["faqs", "Approved FAQ answers", "Use active answers from your FAQ library when responding to shoppers.", "check"],
];

export default function Settings({ loaderData }) {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  useActionToast(fetcher);
  const formRef = useRef(null);
  const settings = loaderData.settings;
  const [provider, setProvider] = useState(settings.aiProvider);
  const saving = fetcher.state !== "idle";
  return <s-page heading="Assistant settings" inlineSize="large">
    <s-button slot="primary-action" type="button" onClick={() => formRef.current?.requestSubmit()} variant="primary" disabled={saving}><AdminIcon name="save"/>{saving ? "Saving…" : "Save settings"}</s-button>
    <AdminPageHeader title="Assistant settings" description="Shape your concierge’s first impression, response style, and the tools shoppers can use." metrics={[{ label: "Features on", value: features.filter(([key]) => settings[key]).length }, { label: "Total features", value: features.length }]} />
    <fetcher.Form ref={formRef} id="assistant-settings-form" method="post" className="settings-layout">
      <div className="settings-main">
        <section className="settings-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="settings" size={19}/></span><div><h2>AI provider</h2><p>Choose the model service that writes concise, store-grounded shopper replies.</p></div></header>
          <label className="settings-field">Provider<select className="admin-text-input" name="aiProvider" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="anthropic">Anthropic Claude</option></select></label>
          <label className="settings-field">{provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Gemini"} API key<input className="admin-text-input" type="password" name="aiApiKey" autoComplete="new-password" placeholder={loaderData.connections.ai && provider === settings.aiProvider ? "Saved securely · paste a new key to replace" : "Paste your API key"}/><small>Your key is encrypted before it is saved and never sent to the storefront. Saving tests the key before connecting it.</small></label>
          <div className={`ai-provider-status ${loaderData.connections.ai && provider === settings.aiProvider ? "connected" : "disconnected"}`}><span className="settings-connection-dot"/><span><strong>{loaderData.connections.ai && provider === settings.aiProvider ? `${provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Claude"} connected` : "Provider not connected"}</strong><small>{loaderData.connections.ai && provider === settings.aiProvider ? "Shopper answers use this provider with retrieved store knowledge." : "Add an API key, then save to verify the connection."}</small></span></div>
          {provider !== "gemini" && <p className="settings-aside-note">Your current Supabase vector index uses Gemini embeddings. Add GEMINI_API_KEY to the server environment for indexing and search; the selected provider will still write shopper answers.</p>}
          <p className="settings-aside-note">AI replies use the closest matching pages, products, policies, and FAQs selected in Knowledge. Product suggestions show up to four closest matches with live Shopify prices and add-to-cart buttons.</p>
        </section>
        <section className="settings-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="chat" size={19}/></span><div><h2>Chat experience</h2><p>Set the welcome message customers see and how the assistant should sound.</p></div></header>
          <label className="settings-field">Welcome message<textarea className="admin-text-input settings-greeting" name="defaultGreeting" defaultValue={settings.defaultGreeting} maxLength={280} rows={3}/><small>This is shown when a shopper opens the chat for the first time.</small></label>
          <label className="settings-field">Answer guidelines<textarea className="admin-text-input settings-guidelines" name="responseGuidelines" defaultValue={settings.responseGuidelines} maxLength={2000} rows={5}/><small>These guidelines are combined with the assistant’s safety rules and approved store content.</small></label>
        </section>
        <section className="settings-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="ticket" size={19}/></span><div><h2>Support ticket IDs</h2><p>Choose the prefix shown on customer confirmations and in your ticket inbox.</p></div></header>
          <label className="settings-field">Ticket ID prefix<input className="admin-text-input" name="ticketPrefix" defaultValue={settings.ticketPrefix} maxLength={10} pattern="[A-Za-z0-9-]+" placeholder="SAC"/><small>Example: SAC-20261124-AB12CD34. Use up to 10 letters, numbers, or hyphens.</small></label>
        </section>
        <section className="settings-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="settings" size={19}/></span><div><h2>Shopper features</h2><p>Turn capabilities on or off for the storefront chat.</p></div></header>
          <div className="settings-feature-list">{features.map(([key, title, description, icon]) => <label className="settings-feature-row" key={key}><span className="settings-feature-icon"><AdminIcon name={icon}/></span><span className="settings-feature-copy"><strong>{title}</strong><small>{description}</small></span><s-switch name={key} checked={settings[key]} aria-label={title}/></label>)}<label className="settings-feature-row"><span className="settings-feature-icon"><AdminIcon name="check"/></span><span className="settings-feature-copy"><strong>Require checkout email</strong><small>When on, shoppers must enter the email on the order. When off, the order number alone is used.</small></span><s-switch name="orderEmailRequired" checked={settings.orderEmailRequired !== false} aria-label="Require checkout email"/></label></div>
        </section>
      </div>
      <aside className="settings-aside">
        <section className="settings-card settings-status-card"><span className="settings-eyebrow">STOREFRONT PREVIEW</span><div className="settings-preview"><div className="settings-preview-top"><span className="settings-preview-mark">✦</span><div><strong>ShopAI Concierge</strong><small>Here to help</small></div><i/></div><p>{settings.defaultGreeting}</p><div className="settings-preview-input">Ask us anything… <span>↑</span></div></div><p className="settings-aside-note">Colors, launcher icon, and widget width are managed in the theme app block.</p><s-button href="/app/rag" onClick={(event) => { event.preventDefault(); navigate("/app/rag"); }} variant="secondary"><AdminIcon name="book"/> Review store knowledge</s-button></section>
        <section className="settings-card"><span className="settings-eyebrow">CONNECTED SERVICES</span><div className="settings-connection"><i className="settings-connection-dot"/><span><strong>Shopify</strong><small>Store catalog and admin session</small></span><em>Connected</em></div><div className="settings-connection"><i className={`settings-connection-dot ${loaderData.connections.ai ? "" : "is-off"}`}/><span><strong>{loaderData.connections.aiProvider === "openai" ? "OpenAI" : loaderData.connections.aiProvider === "anthropic" ? "Anthropic Claude" : "Google Gemini"}</strong><small>Grounded chat answers</small></span><em>{loaderData.connections.ai ? "Connected" : "Not connected"}</em></div><div className="settings-connection"><i className={`settings-connection-dot ${loaderData.connections.embeddings ? "" : "is-off"}`}/><span><strong>Gemini embeddings</strong><small>Semantic search for indexed knowledge</small></span><em>{loaderData.connections.embeddings ? "Configured" : "Add GEMINI_API_KEY"}</em></div><div className="settings-connection"><i className={`settings-connection-dot ${loaderData.connections.supabase ? "" : "is-off"}`}/><span><strong>Supabase</strong><small>Vector database</small></span><em>{loaderData.connections.supabase ? "Configured" : "Add a server secret key"}</em></div></section>
      </aside>
    </fetcher.Form>
  </s-page>;
}
export const headers = (args) => boundary.headers(args);
