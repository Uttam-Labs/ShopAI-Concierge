import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import ListPagination from "../components/ListPagination";
import { useActionToast } from "../components/AdminToast";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { listTickets } = await import("../models.server.js");
  return { tickets: await listTickets(session.shop) };
};
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "open");
  const intent = String(form.get("intent") || "update");
  const prisma = (await import("../db.server.js")).default;
  if (intent === "bulkStatus") {
    let updates;
    try { updates = JSON.parse(String(form.get("updates") || "[]")); }
    catch { return { error: "We couldn’t read the ticket changes. Please try again." }; }
    if (!Array.isArray(updates) || updates.length === 0 || updates.length > 250 || updates.some((item) => !item?.id || !["open", "in_progress", "resolved"].includes(item?.status))) {
      return { error: "Review the ticket status changes and try again." };
    }
    try {
      await prisma.$transaction(updates.map((item) => prisma.ticket.updateMany({ where: { id: String(item.id), shop: session.shop }, data: { status: item.status } })));
      return { saved: true, updated: true };
    } catch (error) {
      console.error("Ticket status update failed", error);
      return { error: "We couldn’t save the ticket changes. Please try again." };
    }
  }
  if (!["open", "in_progress", "resolved"].includes(status)) return { error: "Choose a valid ticket status and try again." };
  try {
  if (intent === "delete") await prisma.ticket.deleteMany({ where: { id, shop: session.shop } });
  else await prisma.ticket.updateMany({ where: { id, shop: session.shop }, data: { status } });
  return { saved: intent !== "delete", deleted: intent === "delete" };
  } catch (error) {
    console.error("Ticket action failed", error);
    return { error: "We couldn’t update that ticket. Please try again." };
  }
};
export default function Tickets({ loaderData }) {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const statusFormRef = useRef(null);
  useActionToast(fetcher);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [pendingStatuses, setPendingStatuses] = useState({});
  useEffect(() => { if (fetcher.data?.deleted) setDeleting(null); }, [fetcher.data]);
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.updated && fetcher.data?.saved) setPendingStatuses({});
  }, [fetcher.state, fetcher.data]);
  const pageSize = 25;
  const filteredTickets = loaderData.tickets.filter((ticket) => `${ticket.reference} ${ticket.customer || ""} ${ticket.email || ""} ${ticket.subject} ${ticket.message}`.toLowerCase().includes(query.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const statusChanges = loaderData.tickets
    .filter((ticket) => pendingStatuses[ticket.id] && pendingStatuses[ticket.id] !== ticket.status)
    .map((ticket) => ({ id: ticket.id, status: pendingStatuses[ticket.id] }));
  const statusLabel = (status) => status === "in_progress" ? "Active" : status === "resolved" ? "Resolved" : "Open";
  return <s-page heading="Support tickets" inlineSize="large">
    <s-button slot="secondary-actions" href="/app/conversations" onClick={(event) => { event.preventDefault(); navigate("/app/conversations"); }} variant="secondary"><AdminIcon name="chat"/> View conversations</s-button>
    {statusChanges.length > 0 && <s-button slot="primary-action" variant="primary" disabled={fetcher.state !== "idle"} onClick={() => statusFormRef.current?.requestSubmit()}><AdminIcon name="save"/>{fetcher.state !== "idle" ? "Saving…" : `Save changes · ${statusChanges.length}`}</s-button>}
    <fetcher.Form ref={statusFormRef} method="post"><input type="hidden" name="intent" value="bulkStatus"/><input type="hidden" name="updates" value={JSON.stringify(statusChanges)}/></fetcher.Form>
    <AdminPageHeader title="Support tickets" description="Track customer issues and handoffs, update progress, and keep every request accountable." metrics={[{ label: "Total tickets", value: loaderData.tickets.length }, { label: "Open", value: loaderData.tickets.filter((ticket) => ticket.status === "open").length }, { label: "Active", value: loaderData.tickets.filter((ticket) => ticket.status === "in_progress").length }, { label: "Resolved", value: loaderData.tickets.filter((ticket) => ticket.status === "resolved").length }]} />
    <section className="ticket-panel">
      <header className="ticket-panel-heading"><div><span className="settings-eyebrow">SUPPORT INBOX</span><h2>Support requests <span>{filteredTickets.length}</span></h2><p>Review reported issues and update ticket progress.</p></div><label className="admin-search-field"><AdminIcon name="search"/><input aria-label="Search tickets" placeholder="Search tickets…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}/></label></header>
      {pageItems.length ? <div className="ticket-list">{pageItems.map((ticket) => <article className="ticket-row" key={ticket.id}>
        <div className="ticket-main"><div className="ticket-title-line"><span className="ticket-id-badge"><AdminIcon name="ticket" size={13}/>{ticket.reference}</span><span className={`ticket-status-pill ${ticket.status}`}>{statusLabel(ticket.status)}</span></div><h3 title={ticket.subject}>{ticket.subject}</h3><small>{ticket.customer || "Guest shopper"}{ticket.email ? ` · ${ticket.email}` : ""} · {new Date(ticket.createdAt).toLocaleDateString()}</small></div>
        <div className="ticket-actions"><button className="admin-secondary ticket-view-button" type="button" onClick={() => setViewing(ticket)}><AdminIcon name="eye"/> View</button><select className="ticket-status-select" value={pendingStatuses[ticket.id] ?? ticket.status} onChange={(event) => setPendingStatuses((current) => { const next = { ...current }; if (event.target.value === ticket.status) delete next[ticket.id]; else next[ticket.id] = event.target.value; return next; })} aria-label={`Ticket status for ${ticket.reference}`}><option value="open">Open</option><option value="in_progress">Active</option><option value="resolved">Resolved</option></select><button className="faq-icon-button danger" type="button" aria-label={`Delete ${ticket.reference}`} title="Delete ticket" onClick={() => setDeleting(ticket)}><AdminIcon name="trash"/></button></div>
      </article>)}</div> : loaderData.tickets.length ? <div className="ticket-empty"><AdminIcon name="search" size={24}/><strong>No tickets match “{query}”</strong><span>Try another ticket number, customer, or issue.</span></div> : <div className="ticket-empty"><span className="admin-empty-icon"><AdminIcon name="check"/></span><strong>No support tickets yet</strong><span>When a customer submits a request, it will appear here with a ticket number.</span></div>}
      {filteredTickets.length > 0 && <ListPagination label="tickets" page={currentPage} pageCount={pageCount} total={filteredTickets.length} onPageChange={setPage}/>}
    </section>
    {viewing && <div className="admin-modal-backdrop ticket-detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setViewing(null)}><section className="admin-modal ticket-detail-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title"><header className="admin-modal-header"><div><span className="admin-modal-kicker">SUPPORT REQUEST</span><h2 id="ticket-detail-title">Ticket details</h2><p>Review the customer’s request and recent chat context.</p></div><button className="admin-modal-x" type="button" aria-label="Close ticket details" onClick={() => setViewing(null)}><AdminIcon name="close" size={18}/></button></header><div className="ticket-detail-badges"><span className="ticket-id-badge"><AdminIcon name="ticket" size={13}/>{viewing.reference}</span><span className={`ticket-status-pill ${viewing.status}`}>{statusLabel(viewing.status)}</span></div><div className="ticket-detail-meta"><div><small>CUSTOMER</small><strong>{viewing.customer || "Guest shopper"}</strong></div><div><small>EMAIL</small><strong>{viewing.email || "Not provided"}</strong></div><div><small>SUBMITTED</small><strong>{new Date(viewing.createdAt).toLocaleString()}</strong></div></div><section className="ticket-detail-section"><span className="settings-eyebrow">ISSUE TITLE</span><h3>{viewing.subject}</h3></section><section className="ticket-detail-section ticket-detail-message"><span className="settings-eyebrow">REQUEST DETAILS & CHAT CONTEXT</span><pre>{viewing.message || "No additional details were provided."}</pre></section></section></div>}
    {deleting && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDeleting(null)}><section className="admin-modal admin-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="ticket-delete-title"><div className="admin-confirm-icon"><AdminIcon name="trash" size={21}/></div><span className="admin-modal-kicker">CONFIRM DELETION</span><h2 id="ticket-delete-title">Delete ticket {deleting.reference}?</h2><p>This support ticket and its details will be permanently removed.</p><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setDeleting(null)}><AdminIcon name="close"/> Keep ticket</button><fetcher.Form method="post"><input type="hidden" name="intent" value="delete"/><input type="hidden" name="id" value={deleting.id}/><button className="admin-danger" type="submit" disabled={fetcher.state === "submitting"}><AdminIcon name="trash"/> Delete ticket</button></fetcher.Form></footer></section></div>}
  </s-page>;
}
export const headers = (args) => boundary.headers(args);
