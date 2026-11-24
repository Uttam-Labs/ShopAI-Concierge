import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
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
  if (!["open", "in_progress", "resolved"].includes(status)) return { error: "Choose a valid ticket status and try again." };
  try {
  const prisma = (await import("../db.server.js")).default;
  const intent = String(form.get("intent") || "update");
  if (intent === "delete") await prisma.ticket.deleteMany({ where: { id, shop: session.shop } });
  else await prisma.ticket.updateMany({ where: { id, shop: session.shop }, data: { status } });
  return { saved: intent !== "delete", deleted: intent === "delete" };
  } catch (error) {
    console.error("Ticket action failed", error);
    return { error: "We couldn’t update that ticket. Please try again." };
  }
};
export default function Tickets({ loaderData }) {
  const fetcher = useFetcher();
  useActionToast(fetcher);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);
  useEffect(() => { if (fetcher.data?.deleted) setDeleting(null); }, [fetcher.data]);
  const pageSize = 25;
  const filteredTickets = loaderData.tickets.filter((ticket) => `${ticket.reference} ${ticket.customer || ""} ${ticket.email || ""} ${ticket.subject} ${ticket.message}`.toLowerCase().includes(query.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <s-page heading="Support tickets" inlineSize="large"><s-button slot="primary-action" href="/app/conversations" variant="secondary"><AdminIcon name="chat"/> View conversations</s-button><AdminPageHeader title="Support tickets" description="Track customer issues and handoffs, update progress, and keep every request accountable." metrics={[{ label: "Total tickets", value: loaderData.tickets.length }, { label: "Open", value: loaderData.tickets.filter((ticket) => ticket.status === "open").length }, { label: "Active", value: loaderData.tickets.filter((ticket) => ticket.status === "in_progress").length }, { label: "Resolved", value: loaderData.tickets.filter((ticket) => ticket.status === "resolved").length }]} /><section className="ticket-panel"><header className="ticket-panel-heading"><div><span className="settings-eyebrow">SUPPORT INBOX</span><h2>Human handoffs <span>{loaderData.tickets.length}</span></h2><p>Review reported issues and update ticket progress.</p></div><label className="admin-search-field"><AdminIcon name="search"/><input aria-label="Search tickets" placeholder="Search tickets…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}/></label></header>{pageItems.length ? <div className="ticket-list">{pageItems.map((ticket) => <article className="ticket-row" key={ticket.id}><div className="ticket-main"><div className="ticket-title-line"><span className="ticket-id-badge"><AdminIcon name="ticket" size={13}/>{ticket.reference}</span><span className={`ticket-status-pill ${ticket.status}`}>{ticket.status === "in_progress" ? "Active" : ticket.status === "resolved" ? "Resolved" : "Open"}</span></div><h3>{ticket.subject}</h3><p>{ticket.message}</p><small>{ticket.customer || "Guest shopper"}{ticket.email ? ` · ${ticket.email}` : ""} · {new Date(ticket.createdAt).toLocaleDateString()}</small></div><div className="ticket-actions"><fetcher.Form method="post"><input type="hidden" name="id" value={ticket.id}/><s-select label="Ticket status" name="status" value={ticket.status}><s-option value="open">Open</s-option><s-option value="in_progress">Active</s-option><s-option value="resolved">Resolved</s-option></s-select><s-button type="submit" variant="secondary" aria-label={`Save status for ${ticket.reference}`}><AdminIcon name="save"/> Save</s-button></fetcher.Form><button className="faq-icon-button danger" type="button" aria-label={`Delete ${ticket.reference}`} title="Delete ticket" onClick={() => setDeleting(ticket)}><AdminIcon name="trash"/></button></div></article>)}</div> : loaderData.tickets.length ? <div className="ticket-empty"><AdminIcon name="search" size={24}/><strong>No tickets match “{query}”</strong><span>Try another ticket number, customer, or issue.</span></div> : <div className="ticket-empty"><span className="admin-empty-icon"><AdminIcon name="check"/></span><strong>No support tickets yet</strong><span>When the concierge hands off a customer issue, the ticket will appear here with a reference number.</span></div>}{filteredTickets.length > 25 && <ListPagination label="tickets" page={currentPage} pageCount={pageCount} total={filteredTickets.length} onPageChange={setPage}/>}</section>{deleting && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDeleting(null)}><section className="admin-modal admin-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="ticket-delete-title"><div className="admin-confirm-icon"><AdminIcon name="trash" size={21}/></div><span className="admin-modal-kicker">CONFIRM DELETION</span><h2 id="ticket-delete-title">Delete ticket {deleting.reference}?</h2><p>This support ticket and its details will be permanently removed.</p><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setDeleting(null)}><AdminIcon name="close"/> Keep ticket</button><fetcher.Form method="post"><input type="hidden" name="intent" value="delete"/><input type="hidden" name="id" value={deleting.id}/><button className="admin-danger" type="submit" disabled={fetcher.state === "submitting"}><AdminIcon name="trash"/> Delete ticket</button></fetcher.Form></footer></section></div>}</s-page>;
}
export const headers = (args) => boundary.headers(args);
