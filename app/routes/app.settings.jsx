import { useFetcher } from "react-router";
import { useRef } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import { useActionToast } from "../components/AdminToast";

const defaults = {
  recommendations: true,
  orderLookup: true,
  humanHandoff: true,
  faqs: true,
  defaultGreeting: "Hi there! 👋 Tell me what you’re shopping for, ask about our policies, or track an order.",
  responseGuidelines: "Be concise, helpful, and on-brand. Use only approved store information. Never invent products, stock, policies, tracking details, or discounts.",
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const prisma = (await import("../db.server.js")).default;
  const row = await prisma.assistantSettings.findUnique({ where: { shop: session.shop } });
  return { settings: { ...defaults, ...(row || {}) }, connections: { openai: Boolean(process.env.OPENAI_API_KEY), supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.DATABASE_URL) } };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const values = {
    recommendations: form.get("recommendations") === "on",
    orderLookup: form.get("orderLookup") === "on",
    humanHandoff: form.get("humanHandoff") === "on",
    faqs: form.get("faqs") === "on",
    defaultGreeting: String(form.get("defaultGreeting") || defaults.defaultGreeting).trim().slice(0, 280),
    responseGuidelines: String(form.get("responseGuidelines") || defaults.responseGuidelines).trim().slice(0, 2000),
  };
  const prisma = (await import("../db.server.js")).default;
  try {
    await prisma.assistantSettings.upsert({ where: { shop: session.shop }, create: { shop: session.shop, ...values }, update: values });
    return { saved: true };
  } catch (error) {
    console.error("Assistant settings save failed", error);
    return { error: "We couldn’t save assistant settings. Please try again." };
  }
};

const features = [
  ["recommendations", "Product recommendations", "Show up to four relevant products when the store catalog matches a shopper’s request.", "book"],
  ["orderLookup", "Order tracking", "Let customers securely check fulfillment status using their order number and checkout email.", "list"],
  ["humanHandoff", "Human support handoff", "Allow the assistant to direct unresolved or sensitive issues to your support team.", "chat"],
  ["faqs", "Approved FAQ answers", "Use active answers from your FAQ library when responding to shoppers.", "check"],
];

export default function Settings({ loaderData }) {
  const fetcher = useFetcher();
  useActionToast(fetcher);
  const formRef = useRef(null);
  const settings = loaderData.settings;
  const saving = fetcher.state !== "idle";
  return <s-page heading="Assistant settings" inlineSize="large">
    <s-button slot="primary-action" type="button" onClick={() => formRef.current?.requestSubmit()} variant="primary" disabled={saving}><AdminIcon name="save"/>{saving ? "Saving…" : "Save settings"}</s-button>
    <AdminPageHeader title="Assistant settings" description="Shape your concierge’s first impression, response style, and the tools shoppers can use." metrics={[{ label: "Features on", value: features.filter(([key]) => settings[key]).length }, { label: "Total features", value: features.length }]} />
    <fetcher.Form ref={formRef} id="assistant-settings-form" method="post" className="settings-layout">
      <div className="settings-main">
        <section className="settings-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="chat" size={19}/></span><div><h2>Chat experience</h2><p>Set the welcome message customers see and how the assistant should sound.</p></div></header>
          <label className="settings-field">Welcome message<textarea className="admin-text-input settings-greeting" name="defaultGreeting" defaultValue={settings.defaultGreeting} maxLength={280} rows={3}/><small>This is shown when a shopper opens the chat for the first time.</small></label>
          <label className="settings-field">Answer guidelines<textarea className="admin-text-input settings-guidelines" name="responseGuidelines" defaultValue={settings.responseGuidelines} maxLength={2000} rows={5}/><small>These guidelines are combined with the assistant’s safety rules and approved store content.</small></label>
        </section>
        <section className="settings-card">
          <header className="settings-card-heading"><span className="settings-card-icon"><AdminIcon name="settings" size={19}/></span><div><h2>Shopper features</h2><p>Turn capabilities on or off for the storefront chat.</p></div></header>
          <div className="settings-feature-list">{features.map(([key, title, description, icon]) => <label className="settings-feature-row" key={key}><span className="settings-feature-icon"><AdminIcon name={icon}/></span><span className="settings-feature-copy"><strong>{title}</strong><small>{description}</small></span><s-switch name={key} checked={settings[key]} aria-label={title}/></label>)}</div>
        </section>
      </div>
      <aside className="settings-aside">
        <section className="settings-card settings-status-card"><span className="settings-eyebrow">STOREFRONT PREVIEW</span><div className="settings-preview"><div className="settings-preview-top"><span className="settings-preview-mark">✦</span><div><strong>ShopAI Concierge</strong><small>Here to help</small></div><i/></div><p>{settings.defaultGreeting}</p><div className="settings-preview-input">Ask us anything… <span>↑</span></div></div><p className="settings-aside-note">Colors, launcher icon, and widget width are managed in the theme app block.</p><s-button href="/app/rag" variant="secondary"><AdminIcon name="book"/> Review store knowledge</s-button></section>
        <section className="settings-card"><span className="settings-eyebrow">CONNECTED SERVICES</span><div className="settings-connection"><i className="settings-connection-dot"/><span><strong>Shopify</strong><small>Store catalog and admin session</small></span><em>Connected</em></div><div className="settings-connection"><i className={`settings-connection-dot ${loaderData.connections.openai ? "" : "is-off"}`}/><span><strong>OpenAI</strong><small>AI answers and embeddings</small></span><em>{loaderData.connections.openai ? "Configured" : "Setup needed"}</em></div><div className="settings-connection"><i className={`settings-connection-dot ${loaderData.connections.supabase ? "" : "is-off"}`}/><span><strong>Supabase</strong><small>Knowledge search database</small></span><em>{loaderData.connections.supabase ? "Configured" : "Setup needed"}</em></div></section>
      </aside>
    </fetcher.Form>
  </s-page>;
}
export const headers = (args) => boundary.headers(args);
