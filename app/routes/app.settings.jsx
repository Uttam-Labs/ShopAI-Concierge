import { useFetcher, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
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
  useEffect(() => {
    if (fetcher.data?.saved && formRef.current) {
      const keyField = formRef.current.querySelector('[name="aiApiKey"]');
      if (keyField) keyField.value = "";
    }
  }, [fetcher.data]);
  const providerName = provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Claude" : "Gemini";
  const currentProviderConnected = loaderData.connections.ai && provider === settings.aiProvider;
  const connectionRows = [
    { name: "Shopify", detail: "Store catalog and admin session", status: "Connected", connected: true },
    { name: loaderData.connections.aiProvider === "openai" ? "OpenAI" : loaderData.connections.aiProvider === "anthropic" ? "Anthropic Claude" : "Google Gemini", detail: "Grounded chat answers", status: loaderData.connections.ai ? "Connected" : "Not connected", connected: loaderData.connections.ai },
    { name: "Gemini embeddings", detail: "Semantic search for indexed knowledge", status: loaderData.connections.embeddings ? "Ready" : "Needs setup", connected: loaderData.connections.embeddings },
    { name: "Supabase", detail: "Vector database", status: loaderData.connections.supabase ? "Connected" : "Needs setup", connected: loaderData.connections.supabase },
  ];
  return <s-page heading="Assistant settings" inlineSize="large">
    <s-button slot="primary-action" type="button" onClick={() => formRef.current?.requestSubmit()} variant="primary" disabled={saving}><AdminIcon name="save"/>{saving ? "Saving…" : "Save settings"}</s-button>
    <AdminPageHeader title="Assistant settings" description="Manage the AI connection, storefront chat, and customer support tools." metrics={[{ label: "Features on", value: features.filter(([key]) => settings[key]).length }, { label: "Total features", value: features.length }]} />
    <fetcher.Form ref={formRef} id="assistant-settings-form" method="post" className="settings-layout settings-layout-polished">
      <div className="settings-main">
        <section className="settings-card settings-section-card settings-ai-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="settings" size={19}/></span><div><span className="settings-section-kicker">AI CONNECTION</span><h2>Choose your AI provider</h2><p>Connect the service that writes concise answers grounded in your store knowledge.</p></div></header>
          <div className="settings-provider-fields">
            <label className="settings-field">Provider<select className="admin-text-input" name="aiProvider" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="anthropic">Anthropic Claude</option></select></label>
            <label className="settings-field">{providerName} API key<input className="admin-text-input" type="password" name="aiApiKey" autoComplete="new-password" placeholder={loaderData.connections.ai && provider === settings.aiProvider ? "Saved securely · paste a new key to replace" : "Paste your API key"}/><small>Encrypted in your app database. Never exposed to the storefront.</small></label>
          </div>
          <div className={`ai-provider-status ${currentProviderConnected ? "connected" : "disconnected"}`}><span className="settings-connection-dot"/><span><strong>{currentProviderConnected ? `${providerName} connected` : "Provider not connected"}</strong><small>{currentProviderConnected ? "Your assistant is using this provider for shopper answers." : "Paste an API key, then save. We’ll verify it before connecting."}</small></span></div>
          {provider !== "gemini" && <div className="settings-info-note"><AdminIcon name="info" size={15}/><p>Knowledge search uses Gemini embeddings. Add <code>GEMINI_API_KEY</code> to Vercel for indexing and semantic search; {providerName} will continue to write the answers.</p></div>}
          <div className="settings-info-note"><AdminIcon name="book" size={15}/><p>Answers use selected products, pages, policies, and FAQs. When a product is a good match, shoppers see up to four suggestions with current prices and Add to cart.</p></div>
        </section>
        <section className="settings-card settings-section-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="chat" size={19}/></span><div><span className="settings-section-kicker">CHAT CONTENT</span><h2>Welcome and answer style</h2><p>Set the first message shoppers see and the tone used in replies.</p></div></header>
          <label className="settings-field">Welcome message<textarea className="admin-text-input settings-greeting" name="defaultGreeting" defaultValue={settings.defaultGreeting} maxLength={280} rows={3}/><small>Shown when a shopper opens the chat for the first time.</small></label>
          <label className="settings-field">Answer guidelines<textarea className="admin-text-input settings-guidelines" name="responseGuidelines" defaultValue={settings.responseGuidelines} maxLength={2000} rows={5}/><small>Added to the assistant’s safety rules and approved store information.</small></label>
        </section>
        <section className="settings-card settings-section-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="settings" size={19}/></span><div><span className="settings-section-kicker">SHOPPER TOOLS</span><h2>Features and access</h2><p>Choose what shoppers can do in the storefront chat.</p></div></header>
          <div className="settings-feature-list">{features.map(([key, title, description, icon]) => <label className="settings-feature-row" key={key}><span className="settings-feature-icon"><AdminIcon name={icon}/></span><span className="settings-feature-copy"><strong>{title}</strong><small>{description}</small></span><s-switch name={key} checked={settings[key]} aria-label={title}/></label>)}<label className="settings-feature-row"><span className="settings-feature-icon"><AdminIcon name="check"/></span><span className="settings-feature-copy"><strong>Require checkout email</strong><small>Ask for the email used on the order before showing order details.</small></span><s-switch name="orderEmailRequired" checked={settings.orderEmailRequired !== false} aria-label="Require checkout email"/></label></div>
        </section>
      </div>
      <aside className="settings-aside">
        <section className="settings-card settings-section-card settings-status-card"><span className="settings-eyebrow">STOREFRONT PREVIEW</span><div className="settings-preview"><div className="settings-preview-top"><span className="settings-preview-mark">✦</span><div><strong>ShopAI Concierge</strong><small>Here to help</small></div><i/></div><p>{settings.defaultGreeting}</p><div className="settings-preview-input">Ask us anything… <span>↑</span></div></div><p className="settings-aside-note">Widget appearance is controlled from the theme app block.</p><s-button href="/app/rag" onClick={(event) => { event.preventDefault(); navigate("/app/rag"); }} variant="secondary"><AdminIcon name="book"/> Review store knowledge</s-button></section>
        <section className="settings-card settings-section-card settings-services-card"><span className="settings-eyebrow">SERVICE STATUS</span><h2>Connected services</h2><p className="settings-services-intro">The systems your concierge uses to answer shoppers.</p>{connectionRows.map((row) => <div className="settings-connection" key={row.name}><i className={`settings-connection-dot ${row.connected ? "" : "is-off"}`}/><span><strong>{row.name}</strong><small>{row.detail}</small></span><em className={row.connected ? "" : "is-pending"}>{row.status}</em></div>)}</section>
        <section className="settings-card settings-section-card settings-ticket-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="ticket" size={19}/></span><div><span className="settings-section-kicker">SUPPORT</span><h2>Ticket references</h2><p>Set the prefix customers and your team see on new support requests.</p></div></header>
          <label className="settings-field settings-prefix-field">Ticket ID prefix<input className="admin-text-input" name="ticketPrefix" defaultValue={settings.ticketPrefix} maxLength={10} pattern="[A-Za-z0-9-]+" placeholder="SAC"/><small>Example: SAC-20261124-AB12CD34 · up to 10 letters, numbers, or hyphens.</small></label>
        </section>
      </aside>
    </fetcher.Form>
  </s-page>;
}
export const headers = (args) => boundary.headers(args);
