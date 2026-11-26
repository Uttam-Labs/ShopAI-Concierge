import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import ListPagination from "../components/ListPagination";
import { Prisma } from "@prisma/client";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const prisma = (await import("../db.server.js")).default;
  const url = new URL(request.url);
  const pageSize = 25;
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const search = String(url.searchParams.get("q") || "").trim().slice(0, 160);
  const searchFilter = search
    ? Prisma.sql`AND ("customerName" ILIKE ${`%${search}%`} OR "customerEmail" ILIKE ${`%${search}%`} OR "session" ILIKE ${`%${search}%`} OR "messages"::text ILIKE ${`%${search}%`})`
    : Prisma.empty;
  const [conversations, countRows, messageRows, recentCount, totalConversations] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`SELECT * FROM "Conversation" WHERE "shop" = ${session.shop} ${searchFilter} ORDER BY "updatedAt" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS "count" FROM "Conversation" WHERE "shop" = ${session.shop} ${searchFilter}`),
    prisma.$queryRaw`SELECT COALESCE(SUM(jsonb_array_length("messages")), 0)::int AS "totalMessages" FROM "Conversation" WHERE "shop" = ${session.shop}`,
    prisma.conversation.count({ where: { shop: session.shop, updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.conversation.count({ where: { shop: session.shop } }),
  ]);
  return { conversations, total: Number(countRows[0]?.count || 0), page, pageSize, search, totalConversations, totalMessages: Number(messageRows[0]?.totalMessages || 0), recentCount };
};

export default function Conversations({ loaderData }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const [active, setActive] = useState(null);
  const [query, setQuery] = useState(loaderData.search);
  useEffect(() => { setQuery(loaderData.search); }, [loaderData.search]);
  useEffect(() => {
    if (query.trim() === loaderData.search) return;
    const timer = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (query.trim()) next.set("q", query.trim()); else next.delete("q");
        next.delete("page");
        return next;
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, loaderData.search, setSearchParams]);
  const conversations = loaderData.conversations;
  const pageCount = Math.max(1, Math.ceil(loaderData.total / loaderData.pageSize));
  const currentPage = Math.min(loaderData.page, pageCount);
  const pageItems = conversations;
  const selected = pageItems.find((item) => item.id === active) || pageItems[0] || null;
  const transcript = Array.isArray(selected?.messages) ? selected.messages : [];
  const changePage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage > 1) next.set("page", String(nextPage)); else next.delete("page");
    setSearchParams(next);
    setActive(null);
  };
  const changeSearch = (value) => {
    setQuery(value);
    setActive(null);
  };

  return <s-page heading="Live concierge" inlineSize="large">
    <s-button slot="primary-action" href="/app/tickets" onClick={(event) => { event.preventDefault(); navigate("/app/tickets"); }} variant="secondary"><AdminIcon name="ticket"/> View tickets</s-button>
    <AdminPageHeader title="Customer conversations" description="A live view of shopper questions and concierge replies. Open a conversation to review the full chat and customer request." metrics={[{ label: "Conversations", value: loaderData.totalConversations }, { label: "Messages", value: loaderData.totalMessages }, { label: "Last 7 days", value: loaderData.recentCount }]} />

    <div className="conversation-workspace">
      <section className="conversation-list-panel" aria-label="Conversation inbox">
        <header className="conversation-panel-heading"><div><span className="rag-eyebrow">SHOPPER INBOX</span><h2>Conversations</h2><p>Newest activity first · 25 per page</p></div><span className="conversation-count">{loaderData.total}</span></header>
        {loaderData.totalConversations > 0 && <label className="admin-search-field conversation-search"><AdminIcon name="search"/><input aria-label="Search conversations" placeholder="Search messages…" value={query} onChange={(event) => changeSearch(event.target.value)}/></label>}
        {loaderData.totalConversations ? pageItems.length ? <div className="conversation-list">{pageItems.map((conversation) => {
          const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
          const latest = messages[messages.length - 1];
          const isSelected = selected?.id === conversation.id;
          return <button className={`conversation-list-item ${isSelected ? "selected" : ""}`} type="button" key={conversation.id} onClick={() => setActive(conversation.id)} aria-pressed={isSelected}>
            <span className="conversation-avatar"><AdminIcon name="chat" size={16}/></span>
            <span className="conversation-list-copy"><span className="conversation-list-top"><strong>{conversation.customerName || `Shopper ${conversation.session.slice(0, 8)}`}</strong><time>{new Date(conversation.updatedAt).toLocaleDateString()}</time></span>{conversation.customerEmail && <span className="conversation-list-email">{conversation.customerEmail}</span>}<span className="conversation-list-preview">{latest?.content || "Conversation started"}</span><span className="conversation-list-foot"><span>{messages.length} {messages.length === 1 ? "message" : "messages"}</span><span>{new Date(conversation.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span></span>
          </button>;
        })}</div> : <div className="conversation-list-empty"><span className="conversation-empty-icon"><AdminIcon name="search" size={21}/></span><strong>No conversations match</strong><p>Try another customer or message keyword.</p></div> : <div className="conversation-list-empty"><span className="conversation-empty-icon"><AdminIcon name="chat" size={21}/></span><strong>No conversations yet</strong><p>When a shopper starts a chat, it will appear here.</p></div>}
        {loaderData.total > 0 && <ListPagination label={loaderData.search ? "matching conversations" : "conversations"} page={currentPage} pageCount={pageCount} total={loaderData.total} onPageChange={changePage}/>}
      </section>

      <section className="conversation-detail-panel" aria-label="Conversation details">
        {selected ? <><header className="conversation-detail-heading"><div className="conversation-avatar large"><AdminIcon name="chat" size={18}/></div><div className="conversation-detail-title"><span className="rag-eyebrow">CHAT TRANSCRIPT</span><h2>{selected.customerName || `Shopper ${selected.session.slice(0, 8)}`}</h2><p>{selected.customerEmail ? `${selected.customerEmail} · ` : "Anonymous · "}Started {new Date(selected.createdAt).toLocaleString()}</p></div><span className="conversation-live-badge"><i/> Conversation</span></header>
          <div className="conversation-meta-strip"><span><AdminIcon name="chat" size={14}/> {transcript.length} {transcript.length === 1 ? "message" : "messages"}</span><span><AdminIcon name="arrow" size={14}/> Updated {new Date(selected.updatedAt).toLocaleString()}</span></div>
          <div className="conversation-transcript">{transcript.length ? transcript.map((message, index) => { const timestamp = message.createdAt || selected.createdAt; return <article className={`conversation-message ${message.role === "user" ? "customer" : "assistant"}`} key={`${selected.id}-${index}`}><span className="conversation-message-author">{message.role === "user" ? "SHOPPER" : "CONCIERGE"}</span><p>{message.content}</p><time dateTime={new Date(timestamp).toISOString()} title={new Date(timestamp).toLocaleString()}>{relativeTime(timestamp, now)}</time></article>; }) : <div className="conversation-list-empty"><strong>No messages recorded</strong></div>}</div>
        </> : <div className="conversation-detail-empty"><span className="conversation-empty-icon"><AdminIcon name="chat" size={23}/></span><h2>Your inbox is ready</h2><p>When a shopper opens the storefront chat, their messages and requests will appear here.</p><div className="conversation-empty-tip"><AdminIcon name="check" size={15}/> Conversation history is saved automatically</div></div>}
      </section>
    </div>
  </s-page>;
}

function relativeTime(value, now) {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const headers = (args) => boundary.headers(args);
