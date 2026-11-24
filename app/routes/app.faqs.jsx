import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import ListPagination from "../components/ListPagination";
import { useActionToast } from "../components/AdminToast";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { faqs: await (await import("../models.server.js")).listFaqs(session.shop) };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
  const prisma = (await import("../db.server.js")).default;
  const intent = String(form.get("intent") || "create");
  const id = String(form.get("id") || "");
  if (intent === "delete") {
    await prisma.faq.deleteMany({ where: { id, shop: session.shop } });
    return { deleted: true };
  }
  if (intent === "toggle") {
    const active = form.get("active") === "true";
    await prisma.faq.updateMany({ where: { id, shop: session.shop }, data: { active } });
    return { updated: true };
  }
  const question = String(form.get("question") || "").trim();
  const answer = String(form.get("answer") || "").trim();
  const active = form.get("active") !== "false";
  if (!question || !answer) return { error: "Enter both a question and an answer before saving." };
  if (intent === "update") await prisma.faq.updateMany({ where: { id, shop: session.shop }, data: { question, answer, active } });
  else await prisma.faq.create({ data: { shop: session.shop, question, answer, active } });
  return { saved: true };
  } catch (error) {
    console.error("FAQ action failed", error);
    return { error: "We couldn’t save that FAQ. Please try again." };
  }
};

export default function Faqs({ loaderData }) {
  const fetcher = useFetcher();
  useActionToast(fetcher);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (fetcher.data?.saved) { setShowCreate(false); setEditing(null); }
    if (fetcher.data?.deleted) setDeleting(null);
  }, [fetcher.data]);
  const pageSize = 25;
  const filteredFaqs = loaderData.faqs.filter((faq) => `${faq.question} ${faq.answer} ${faq.active ? "active" : "draft"}`.toLowerCase().includes(query.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filteredFaqs.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageFaqs = filteredFaqs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeCount = loaderData.faqs.filter((faq) => faq.active).length;
  const draftCount = loaderData.faqs.length - activeCount;

  return <s-page heading="FAQs" inlineSize="large">
    <s-button slot="primary-action" variant="primary" onClick={() => setShowCreate(true)}><AdminIcon name="plus" /> Add FAQ</s-button>
    <AdminPageHeader title="Frequently asked questions" description="Manage approved answers for your concierge. Keep drafts ready for review and activate only the guidance shoppers should see." metrics={[{ label: "Total FAQs", value: loaderData.faqs.length }, { label: "Active", value: activeCount }, { label: "Drafts", value: draftCount }]} />
    <section className="faq-page-list"><header className="faq-page-list-heading"><div><span className="faq-section-icon"><AdminIcon name="list"/></span><div><h2>FAQ library</h2><p>{loaderData.faqs.length} saved {loaderData.faqs.length === 1 ? "answer" : "answers"} · {activeCount} active for shoppers</p></div></div><div className="faq-heading-actions">{loaderData.faqs.length > 0 && <label className="admin-search-field"><AdminIcon name="search"/><input aria-label="Search FAQs" placeholder="Search questions…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}/></label>}<button className="admin-cta" type="button" onClick={() => setShowCreate(true)}><AdminIcon name="plus"/> Add FAQ</button></div></header>
      {loaderData.faqs.length ? filteredFaqs.length ? <><div className="faq-list">{pageFaqs.map((faq) => <article className="faq-list-item" key={faq.id}><div className="faq-list-copy"><div className="faq-list-title-row"><strong>{faq.question}</strong><span className={`faq-status ${faq.active ? "active" : "draft"}`}>{faq.active ? "Active" : "Draft"}</span></div><p>{faq.answer}</p><small>Added {new Date(faq.createdAt).toLocaleDateString()}</small></div><div className="faq-list-actions"><fetcher.Form method="post"><input type="hidden" name="intent" value="toggle"/><input type="hidden" name="id" value={faq.id}/><input type="hidden" name="active" value={String(!faq.active)}/><button className={`faq-status-button ${faq.active ? "to-draft" : "to-active"}`} type="submit" title={faq.active ? "Move to drafts" : "Activate FAQ"}><AdminIcon name={faq.active ? "archive" : "check"}/>{faq.active ? "Make draft" : "Activate"}</button></fetcher.Form><button className="faq-icon-button" type="button" title="Edit FAQ" aria-label={`Edit ${faq.question}`} onClick={() => setEditing(faq)}><AdminIcon name="edit"/></button><button className="faq-icon-button danger" type="button" title="Delete FAQ" aria-label={`Delete ${faq.question}`} onClick={() => setDeleting(faq)}><AdminIcon name="trash"/></button></div></article>)}</div>{pageCount > 1 && <ListPagination label="FAQs" page={currentPage} pageCount={pageCount} total={filteredFaqs.length} onPageChange={setPage}/>}</> : <div className="ticket-empty"><AdminIcon name="search" size={24}/><strong>No FAQs match “{query}”</strong><span>Try another word or phrase.</span></div> : <div className="admin-empty faq-empty"><span className="admin-empty-icon">?</span><strong>No FAQs yet</strong><span>Add your first store-approved answer to get started.</span><button className="admin-cta" type="button" onClick={() => setShowCreate(true)}><AdminIcon name="plus"/> Add FAQ</button></div>}
    </section>

    {showCreate && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowCreate(false)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="faq-create-title"><header className="admin-modal-header"><div><span className="admin-modal-kicker">NEW ANSWER</span><h2 id="faq-create-title">Add a FAQ</h2><p>Write a clear answer based on your store policies.</p></div><button className="admin-modal-x" type="button" aria-label="Close" onClick={() => setShowCreate(false)}><AdminIcon name="close" size={18}/></button></header><fetcher.Form method="post"><input type="hidden" name="intent" value="create"/><label className="admin-field">Customer question<input className="admin-text-input" name="question" placeholder="e.g. How long does shipping take?" required/></label><label className="admin-field">Answer<textarea className="admin-text-input admin-textarea" name="answer" placeholder="Write the answer your support team would give." required/></label><label className="admin-field">Availability<select className="admin-text-input" name="active" defaultValue="true"><option value="true">Active · available to shoppers</option><option value="false">Draft · hidden from shoppers</option></select></label><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setShowCreate(false)}><AdminIcon name="close"/> Cancel</button><button className="admin-cta" type="submit" disabled={fetcher.state === "submitting"}><AdminIcon name="save"/>{fetcher.state === "submitting" ? "Saving…" : "Save FAQ"}</button></footer></fetcher.Form></section></div>}

    {editing && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="faq-edit-title"><header className="admin-modal-header"><div><span className="admin-modal-kicker">FAQ EDITOR</span><h2 id="faq-edit-title">Edit question</h2><p>Changes apply to future concierge answers.</p></div><button className="admin-modal-x" type="button" aria-label="Close" onClick={() => setEditing(null)}><AdminIcon name="close" size={18}/></button></header><fetcher.Form method="post"><input type="hidden" name="intent" value="update"/><input type="hidden" name="id" value={editing.id}/><label className="admin-field">Customer question<input className="admin-text-input" name="question" defaultValue={editing.question} required/></label><label className="admin-field">Answer<textarea className="admin-text-input admin-textarea" name="answer" defaultValue={editing.answer} required/></label><label className="admin-field">Availability<select className="admin-text-input" name="active" defaultValue={String(editing.active)}><option value="true">Active · available to shoppers</option><option value="false">Draft · hidden from shoppers</option></select></label><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setEditing(null)}><AdminIcon name="close"/> Cancel</button><button className="admin-cta" type="submit" disabled={fetcher.state === "submitting"}><AdminIcon name="save"/> Save changes</button></footer></fetcher.Form></section></div>}

    {deleting && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDeleting(null)}><section className="admin-modal admin-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="faq-delete-title"><div className="admin-confirm-icon"><AdminIcon name="trash" size={21}/></div><span className="admin-modal-kicker">CONFIRM DELETION</span><h2 id="faq-delete-title">Delete this FAQ?</h2><p>“{deleting.question}” will be permanently removed from your saved questions. This cannot be undone.</p><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setDeleting(null)}><AdminIcon name="close"/> Keep FAQ</button><fetcher.Form method="post"><button className="admin-danger" type="submit" disabled={fetcher.state === "submitting"}><AdminIcon name="trash"/> Delete FAQ</button><input type="hidden" name="intent" value="delete"/><input type="hidden" name="id" value={deleting.id}/></fetcher.Form></footer></section></div>}
  </s-page>;
}

export const headers = (args) => boundary.headers(args);
