import { boundary } from "@shopify/shopify-app-react-router/server";
import { useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import { resolveEmbeddingKey, resolveProviderKey } from "../ai.server";
import { hasSupabaseServerConfig } from "../supabase.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const [response, prisma] = await Promise.all([admin.graphql(`#graphql
    query ConciergeOverview {
      shop { name }
      productsCount { count }
      orders(first: 1, sortKey: CREATED_AT, reverse: true) { pageInfo { hasNextPage } }
    }
  `), import("../db.server.js").then((module) => module.default)]);
  const result = await response.json();
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
  const [conversations, tickets, faqs, knowledge, assistantSettings] = await Promise.all([
    prisma.conversation.findMany({ where: { shop: session.shop, updatedAt: { gte: start } }, select: { updatedAt: true } }),
    prisma.ticket.findMany({ where: { shop: session.shop, createdAt: { gte: start } }, select: { createdAt: true, status: true } }),
    prisma.faq.count({ where: { shop: session.shop, active: true } }),
    prisma.knowledgeConfig.findUnique({ where: { shop: session.shop } }),
    prisma.assistantSettings.findUnique({ where: { shop: session.shop }, select: { aiProvider: true, aiApiKeyEncrypted: true } }),
  ]);
  const activity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start); day.setDate(start.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    return { label: day.toLocaleDateString("en", { weekday: "short" }), conversations: conversations.filter((item) => item.updatedAt.toISOString().slice(0, 10) === key).length, tickets: tickets.filter((item) => item.createdAt.toISOString().slice(0, 10) === key).length };
  });
  const integrations = { ai: Boolean(resolveProviderKey(assistantSettings || { aiProvider: "gemini" })), aiProvider: assistantSettings?.aiProvider || "gemini", embeddings: Boolean(resolveEmbeddingKey(assistantSettings || { aiProvider: "gemini" })), supabase: hasSupabaseServerConfig() };
  const sourceArrays = [knowledge?.productIds, knowledge?.collectionIds, knowledge?.pageIds, knowledge?.policyIds, knowledge?.customSources];
  return { shop: result.data?.shop, products: result.data?.productsCount?.count ?? 0, orders: result.data?.orders?.pageInfo?.hasNextPage ? "1+" : 0, activity, totals: { conversations: conversations.length, tickets: tickets.length, openTickets: tickets.filter((ticket) => ticket.status !== "resolved").length, faqs, knowledge: sourceArrays.reduce((sum, values) => sum + (Array.isArray(values) ? values.length : 0), 0) }, integrations };
};

function ActivityChart({ data }) {
  const max = Math.max(1, ...data.map((day) => day.conversations + day.tickets));
  return <div className="dashboard-chart" role="img" aria-label="Daily conversations and tickets for the last seven days"><div className="dashboard-chart-legend"><span><i className="legend-conversations"/> Conversations</span><span><i className="legend-tickets"/> Tickets</span></div><div className="dashboard-bars">{data.map((day) => { const total = day.conversations + day.tickets; const height = total ? Math.max(12, total / max * 100) : 3; const conversationHeight = total ? day.conversations / total * height : 0; return <div className="dashboard-bar-column" key={day.label} title={`${day.label}: ${day.conversations} conversations, ${day.tickets} tickets`}><span className="dashboard-bar-value">{total || ""}</span><div className="dashboard-bar-track"><div className="dashboard-bar-stack" style={{ height: `${height}%` }}><i className="dashboard-bar-conversations" style={{ height: `${conversationHeight / height * 100}%` }}/><i className="dashboard-bar-tickets"/></div></div><small>{day.label}</small></div>; })}</div></div>;
}

export default function Dashboard({ loaderData }) {
  const navigate = useNavigate();
  const { shop, products, activity, totals, integrations } = loaderData;
  const ready = integrations.ai && integrations.embeddings && integrations.supabase;
  return <s-page heading="ShopAI Concierge" inlineSize="large">
    <s-button slot="primary-action" href="/app/rag" onClick={(event) => { event.preventDefault(); navigate("/app/rag"); }} variant="primary"><AdminIcon name="book"/> Manage knowledge</s-button>
    <AdminPageHeader title="Merchant dashboard" description={`A clear view of your concierge${shop?.name ? ` at ${shop.name}` : ""}. Monitor shopper support activity and keep your assistant up to date.`} metrics={[{ label: "Products", value: products }, { label: "Conversations · 7 days", value: totals.conversations }, { label: "Open tickets", value: totals.openTickets }]} />
    <div className="dashboard-stat-grid"><a className="dashboard-stat-card" href="/app/conversations" onClick={(event) => { event.preventDefault(); navigate("/app/conversations"); }}><span className="dashboard-stat-icon"><AdminIcon name="chat"/></span><span><small>SHOPPER CONVERSATIONS</small><strong>{totals.conversations}</strong><em>Last 7 days</em></span><AdminIcon name="arrow"/></a><a className="dashboard-stat-card" href="/app/tickets" onClick={(event) => { event.preventDefault(); navigate("/app/tickets"); }}><span className="dashboard-stat-icon warm"><AdminIcon name="ticket"/></span><span><small>SUPPORT TICKETS</small><strong>{totals.tickets}</strong><em>{totals.openTickets} need attention</em></span><AdminIcon name="arrow"/></a><a className="dashboard-stat-card" href="/app/faqs" onClick={(event) => { event.preventDefault(); navigate("/app/faqs"); }}><span className="dashboard-stat-icon"><AdminIcon name="list"/></span><span><small>ACTIVE ANSWERS</small><strong>{totals.faqs}</strong><em>Approved FAQs</em></span><AdminIcon name="arrow"/></a><a className="dashboard-stat-card" href="/app/rag" onClick={(event) => { event.preventDefault(); navigate("/app/rag"); }}><span className="dashboard-stat-icon warm"><AdminIcon name="book"/></span><span><small>KNOWLEDGE SOURCES</small><strong>{totals.knowledge}</strong><em>Indexed store content</em></span><AdminIcon name="arrow"/></a></div>
    <div className="dashboard-content-grid"><section className="dashboard-panel"><header className="dashboard-panel-heading"><div><span className="settings-eyebrow">SUPPORT ACTIVITY</span><h2>Shopper activity</h2><p>Conversations and support tickets over the past week.</p></div><span className="dashboard-period">Last 7 days</span></header><ActivityChart data={activity}/><footer className="dashboard-chart-footer"><span><strong>{totals.conversations}</strong> conversations</span><span><strong>{totals.tickets}</strong> tickets created</span></footer></section><section className="dashboard-panel dashboard-health"><header className="dashboard-panel-heading"><div><span className="settings-eyebrow">ASSISTANT HEALTH</span><h2>{ready ? "Ready to assist" : "Setup in progress"}</h2><p>Services powering your storefront concierge.</p></div><span className={`dashboard-health-badge ${ready ? "ready" : "pending"}`}>{ready ? "Ready" : "Action needed"}</span></header><div className="dashboard-health-list"><div><span className="dashboard-health-dot ready"/><span><strong>Shopify store</strong><small>{products} products available</small></span><em>Connected</em></div><div><span className={`dashboard-health-dot ${integrations.ai ? "ready" : "pending"}`}/><span><strong>{integrations.aiProvider === "openai" ? "OpenAI" : integrations.aiProvider === "anthropic" ? "Anthropic Claude" : "Google Gemini"}</strong><small>Grounded assistant answers</small></span><em>{integrations.ai ? "Connected" : "Add API key in settings"}</em></div><div><span className={`dashboard-health-dot ${integrations.supabase && integrations.embeddings ? "ready" : "pending"}`}/><span><strong>Knowledge search</strong><small>Supabase vector database and Gemini embeddings</small></span><em>{integrations.supabase && integrations.embeddings ? "Connected" : "Configure vector search"}</em></div></div><s-button href="/app/settings" onClick={(event) => { event.preventDefault(); navigate("/app/settings"); }} variant="secondary"><AdminIcon name="settings"/> Assistant settings</s-button></section></div>
    <section className="dashboard-quick-links"><div><span className="settings-eyebrow">YOUR WORKSPACE</span><h2>Keep your concierge current</h2><p>Refresh trusted store content, review shopper questions, and stay on top of support handoffs.</p></div><div className="dashboard-quick-actions"><s-button href="/app/conversations" onClick={(event) => { event.preventDefault(); navigate("/app/conversations"); }} variant="secondary"><AdminIcon name="chat"/> Conversations</s-button><s-button href="/app/tickets" onClick={(event) => { event.preventDefault(); navigate("/app/tickets"); }} variant="secondary"><AdminIcon name="ticket"/> Support tickets</s-button><s-button href="/app/rag" onClick={(event) => { event.preventDefault(); navigate("/app/rag"); }} variant="primary"><AdminIcon name="book"/> Knowledge library</s-button></div></section>
  </s-page>;
}
export const headers = (args) => boundary.headers(args);
