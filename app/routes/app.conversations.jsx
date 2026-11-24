import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import ListPagination from "../components/ListPagination";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const prisma = (await import("../db.server.js")).default;
  return { conversations: await prisma.conversation.findMany({ where: { shop: session.shop }, orderBy: { updatedAt: "desc" } }) };
};

export default function Conversations({ loaderData }) {
  const [active, setActive] = useState(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const conversations = loaderData.conversations;
  const filteredConversations = conversations.filter((item) => {
    const messages = Array.isArray(item.messages) ? item.messages : [];
    return `shopper ${item.session} ${messages.map((message) => message.content).join(" ")}`.toLowerCase().includes(query.toLowerCase());
  });
  const pageCount = Math.max(1, Math.ceil(filteredConversations.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filteredConversations.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = filteredConversations.find((item) => item.id === active) || pageItems[0] || null;
  const transcript = Array.isArray(selected?.messages) ? selected.messages : [];
  const totalMessages = conversations.reduce((total, item) => total + (Array.isArray(item.messages) ? item.messages.length : 0), 0);
  const recentCount = conversations.filter((item) => Date.now() - new Date(item.updatedAt).getTime() < 7 * 24 * 60 * 60 * 1000).length;

  return <s-page heading="Live concierge" inlineSize="large">
    <s-button slot="primary-action" href="/app/tickets" variant="secondary"><AdminIcon name="ticket"/> View tickets</s-button>
    <AdminPageHeader title="Customer conversations" description="A live view of shopper questions and concierge replies. Open a conversation to review the full chat and customer request." metrics={[{ label: "Conversations", value: conversations.length }, { label: "Messages", value: totalMessages }, { label: "Last 7 days", value: recentCount }]} />

    <div className="conversation-workspace">
      <section className="conversation-list-panel" aria-label="Conversation inbox">
        <header className="conversation-panel-heading"><div><span className="rag-eyebrow">SHOPPER INBOX</span><h2>Conversations</h2><p>Newest activity first</p></div><span className="conversation-count">{conversations.length}</span></header>
        {conversations.length > 0 && <label className="admin-search-field conversation-search"><AdminIcon name="search"/><input aria-label="Search conversations" placeholder="Search messages…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); setActive(null); }}/></label>}
        {conversations.length ? pageItems.length ? <div className="conversation-list">{pageItems.map((conversation) => {
          const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
          const latest = messages[messages.length - 1];
          const isSelected = selected?.id === conversation.id;
          return <button className={`conversation-list-item ${isSelected ? "selected" : ""}`} type="button" key={conversation.id} onClick={() => setActive(conversation.id)} aria-pressed={isSelected}>
            <span className="conversation-avatar"><AdminIcon name="chat" size={16}/></span>
            <span className="conversation-list-copy"><span className="conversation-list-top"><strong>Shopper {conversation.session.slice(0, 8)}</strong><time>{new Date(conversation.updatedAt).toLocaleDateString()}</time></span><span className="conversation-list-preview">{latest?.content || "Conversation started"}</span><span className="conversation-list-foot"><span>{messages.length} {messages.length === 1 ? "message" : "messages"}</span><span>{new Date(conversation.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span></span>
          </button>;
        })}</div> : <div className="conversation-list-empty"><span className="conversation-empty-icon"><AdminIcon name="search" size={21}/></span><strong>No conversations match</strong><p>Try another customer or message keyword.</p></div> : <div className="conversation-list-empty"><span className="conversation-empty-icon"><AdminIcon name="chat" size={21}/></span><strong>No conversations yet</strong><p>When a shopper starts a chat, it will appear here.</p></div>}
        {filteredConversations.length > 25 && <ListPagination label="conversations" page={currentPage} pageCount={pageCount} total={filteredConversations.length} onPageChange={(nextPage) => { setPage(nextPage); setActive(filteredConversations[(nextPage - 1) * pageSize]?.id || null); }}/ >}
      </section>

      <section className="conversation-detail-panel" aria-label="Conversation details">
        {selected ? <><header className="conversation-detail-heading"><div className="conversation-avatar large"><AdminIcon name="chat" size={18}/></div><div className="conversation-detail-title"><span className="rag-eyebrow">CHAT TRANSCRIPT</span><h2>Shopper {selected.session.slice(0, 8)}</h2><p>Started {new Date(selected.createdAt).toLocaleString()}</p></div><span className="conversation-live-badge"><i/> Conversation</span></header>
          <div className="conversation-meta-strip"><span><AdminIcon name="chat" size={14}/> {transcript.length} {transcript.length === 1 ? "message" : "messages"}</span><span><AdminIcon name="arrow" size={14}/> Updated {new Date(selected.updatedAt).toLocaleString()}</span></div>
          <div className="conversation-transcript">{transcript.length ? transcript.map((message, index) => <article className={`conversation-message ${message.role === "user" ? "customer" : "assistant"}`} key={`${selected.id}-${index}`}><span className="conversation-message-author">{message.role === "user" ? "SHOPPER" : "CONCIERGE"}</span><p>{message.content}</p></article>) : <div className="conversation-list-empty"><strong>No messages recorded</strong></div>}</div>
        </> : <div className="conversation-detail-empty"><span className="conversation-empty-icon"><AdminIcon name="chat" size={23}/></span><h2>Your inbox is ready</h2><p>When a shopper opens the storefront chat, their messages and requests will appear here.</p><div className="conversation-empty-tip"><AdminIcon name="check" size={15}/> Conversation history is saved automatically</div></div>}
      </section>
    </div>
  </s-page>;
}

export const headers = (args) => boundary.headers(args);
