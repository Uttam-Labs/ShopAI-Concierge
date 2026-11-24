import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import { useActionToast } from "../components/AdminToast";
import { embedTexts, hasGeminiKey } from "../gemini.server";
import { createSupabaseServerClient, hasSupabaseServerConfig } from "../supabase.server";

const parseList = (value, fallback = []) => { try { const parsed = JSON.parse(String(value || "")); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } };

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  // Keep the initial knowledge page response small. Full source content is
  // fetched only when the merchant saves/indexes selected items.
  const [response, prisma] = await Promise.all([
    admin.graphql(`#graphql
      query KnowledgeLibrary {
        products(first: 100, sortKey: TITLE) { edges { node { id title status vendor productType handle featuredImage { url } variants(first: 1) { edges { node { id title price availableForSale } } } } } }
        collections(first: 100, sortKey: TITLE) { edges { node { id title handle productsCount { count } image { url } } } }
        pages(first: 100, sortKey: TITLE) { edges { node { id title handle } } }
      }
    `),
    import("../db.server.js").then((module) => module.default),
  ]);
  const [result, config] = await Promise.all([
    response.json(),
    prisma.knowledgeConfig.findUnique({ where: { shop: session.shop } }),
  ]);
  const data = result.data ?? {};
  const products = data.products?.edges?.map(({ node }) => node) ?? [];
  const collections = data.collections?.edges?.map(({ node }) => node) ?? [];
  const pages = data.pages?.edges?.map(({ node }) => node) ?? [];
  const productIds = config?.productIds ?? [];
  const collectionIds = config?.collectionIds ?? [];
  const pageIds = config?.pageIds ?? [];
  const policyIds = config?.policyIds ?? [];
  const customSources = config?.customSources ?? [];
  const policies = pages.filter((page) => /policy|shipping|refund|return|privacy|terms|size|sizing/i.test(`${page.title} ${page.handle}`));
  const selected = [
    ...products.filter((item) => productIds.includes(item.id)).map((item) => ({ ...item, sourceType: "product" })),
    ...collections.filter((item) => collectionIds.includes(item.id)).map((item) => ({ ...item, sourceType: "collection" })),
    ...pages.filter((item) => pageIds.includes(item.id)).map((item) => ({ ...item, sourceType: "page" })),
    ...policies.filter((item) => policyIds.includes(item.id)).map((item) => ({ ...item, sourceType: "policy" })),
    ...customSources.map((item) => ({ ...item, sourceType: "custom" })),
  ];
  return { products, collections, pages, policies, productIds, collectionIds, pageIds, policyIds, customSources, selected, shopHandle: session.shop.replace(/\.myshopify\.com$/i, "") };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  const productIds = parseList(form.get("productIds"));
  const collectionIds = parseList(form.get("collectionIds"));
  const pageIds = parseList(form.get("pageIds"));
  const policyIds = parseList(form.get("policyIds"));
  const customSources = parseList(form.get("customSources"));
  const prisma = (await import("../db.server.js")).default;
  try {
    await prisma.knowledgeConfig.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop, productIds, collectionIds, pageIds, policyIds, customSources },
      update: { productIds, collectionIds, pageIds, policyIds, customSources },
    });
  } catch (error) {
    console.error("Knowledge save failed", error);
    return { error: "We couldn’t save these knowledge sources. Please try again." };
  }
  if (!hasGeminiKey() || !hasSupabaseServerConfig()) return { saved: true, indexed: false, selectedCount: productIds.length + collectionIds.length + pageIds.length + policyIds.length + customSources.length };
  try {
    const supabase = createSupabaseServerClient();
    const docs = [];
    const idsToFetch = [...productIds, ...collectionIds, ...pageIds, ...policyIds];
    for (let offset = 0; offset < idsToFetch.length; offset += 50) {
      const ids = idsToFetch.slice(offset, offset + 50);
      const result = await admin.graphql(`#graphql query SelectedKnowledge { nodes(ids: ${JSON.stringify(ids)}) { ... on Product { id title descriptionHtml vendor productType tags featuredImage { url } variants(first: 100) { edges { node { id title price availableForSale } } } } ... on Collection { id title handle description image { url } products(first: 100) { edges { node { title } } } } ... on Page { id title body handle } } }`);
      const nodes = (await result.json()).data?.nodes ?? [];
      for (const node of nodes) {
        if (!node) continue;
        if (node.variants) docs.push({ source_type: "product", source_id: node.id, title: node.title, content: [node.title, node.descriptionHtml?.replace(/<[^>]+>/g, " "), node.vendor, node.productType, node.tags?.join(", "), ...(node.variants.edges ?? []).map(({ node: variant }) => `${variant.title} $${variant.price} ${variant.availableForSale ? "in stock" : "out of stock"}`)].filter(Boolean).join("\n"), metadata: { handle: node.handle, image: node.featuredImage?.url, variants: node.variants.edges?.map(({ node: variant }) => variant) } });
        else if (node.products) docs.push({ source_type: "collection", source_id: node.id, title: node.title, content: [node.title, node.description, ...(node.products.edges ?? []).map(({ node: product }) => product.title)].filter(Boolean).join("\n"), metadata: { handle: node.handle, image: node.image?.url } });
        else docs.push({ source_type: policyIds.includes(node.id) ? "policy" : "page", source_id: node.id, title: node.title, content: `${node.title}\n${node.body?.replace(/<[^>]+>/g, " ") || ""}`, metadata: { handle: node.handle } });
      }
    }
    for (const item of customSources) docs.push({ source_type: "custom", source_id: item.id, title: item.title, content: item.content, metadata: { category: item.category || "Custom content" } });
    const rows = [];
    for (let i = 0; i < docs.length; i += 100) {
      const batch = docs.slice(i, i + 100);
      const embeddings = await embedTexts(batch.map((doc) => `${doc.title}\n${doc.content}`.slice(0, 6000)), "RETRIEVAL_DOCUMENT");
      batch.forEach((doc, index) => rows.push({ ...doc, metadata: { ...doc.metadata, embedding_model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001" }, shop_domain: session.shop, embedding: embeddings[index] }));
    }
    if (rows.length) {
      const { error } = await supabase.from("shopai_knowledge").upsert(rows, { onConflict: "shop_domain,source_type,source_id" });
      if (error) throw error;
    }
    const retainedSources = new Set(rows.map((row) => `${row.source_type}:${row.source_id}`));
    const { data: existingSources, error: readError } = await supabase.from("shopai_knowledge").select("id,source_type,source_id").eq("shop_domain", session.shop);
    if (readError) throw readError;
    const staleIds = (existingSources || []).filter((row) => !retainedSources.has(`${row.source_type}:${row.source_id}`)).map((row) => row.id);
    for (let offset = 0; offset < staleIds.length; offset += 500) {
      const { error } = await supabase.from("shopai_knowledge").delete().eq("shop_domain", session.shop).in("id", staleIds.slice(offset, offset + 500));
      if (error) throw error;
    }
    return { saved: true, indexed: true, indexedCount: rows.length };
  } catch (error) { console.error("Knowledge indexing failed", error); return { saved: true, indexed: false, error: "Sources saved, but Gemini indexing failed. Check GEMINI_API_KEY, the Supabase server secret, and the Gemini vector migration." }; }
};

const tabs = [
  ["products", "Products", "P"], ["collections", "Collections", "C"], ["pages", "Pages", "↗"], ["policies", "Policies", "§"], ["custom", "Custom content", "+"],
];

export default function RagSettings({ loaderData }) {
  const fetcher = useFetcher();
  useActionToast(fetcher);
  useEffect(() => { if (fetcher.data?.saved) setConfirmSave(false); }, [fetcher.data]);
  const [activeTab, setActiveTab] = useState("products");
  const [modal, setModal] = useState(null);
  const [draftIds, setDraftIds] = useState({ products: loaderData.productIds, collections: loaderData.collectionIds, pages: loaderData.pageIds, policies: loaderData.policyIds });
  const [customSources, setCustomSources] = useState(loaderData.customSources);
  const [pending, setPending] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedPage, setSelectedPage] = useState(1);
  const [customDraft, setCustomDraft] = useState({ title: "", content: "" });
  const [confirmSave, setConfirmSave] = useState(false);

  const currentItems = useMemo(() => ({ products: loaderData.products, collections: loaderData.collections, pages: loaderData.pages, policies: loaderData.policies, custom: customSources }[activeTab] || []), [activeTab, loaderData, customSources]);
  const selectedCount = draftIds.products.length + draftIds.collections.length + draftIds.pages.length + draftIds.policies.length + customSources.length;
  const activeLabels = { products: "products", collections: "collections", pages: "pages", policies: "policies", custom: "custom content" };
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(currentItems.length / pageSize));
  const pageItems = currentItems.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  const selectedItems = [
    ...loaderData.products.filter((item) => draftIds.products.includes(item.id)).map((item) => ({ ...item, sourceType: "product" })),
    ...loaderData.collections.filter((item) => draftIds.collections.includes(item.id)).map((item) => ({ ...item, sourceType: "collection" })),
    ...loaderData.pages.filter((item) => draftIds.pages.includes(item.id)).map((item) => ({ ...item, sourceType: "page" })),
    ...loaderData.policies.filter((item) => draftIds.policies.includes(item.id)).map((item) => ({ ...item, sourceType: "policy" })),
    ...customSources.map((item) => ({ ...item, sourceType: "custom" })),
  ];
  const selectedPageCount = Math.max(1, Math.ceil(selectedItems.length / pageSize));
  const selectedPageIndex = Math.min(selectedPage, selectedPageCount);
  const selectedPageItems = selectedItems.slice((selectedPageIndex - 1) * pageSize, selectedPageIndex * pageSize);
  const sourceUrl = (item) => {
    const resourceId = String(item.id || "").split("/").pop();
    const adminBase = `https://admin.shopify.com/store/${encodeURIComponent(loaderData.shopHandle)}`;
    if (item.sourceType === "product") return `${adminBase}/products/${encodeURIComponent(resourceId)}`;
    if (item.sourceType === "collection") return `${adminBase}/collections/${encodeURIComponent(resourceId)}`;
    if (item.sourceType === "page" || item.sourceType === "policy") return `${adminBase}/pages/${encodeURIComponent(resourceId)}`;
    return null;
  };
  const togglePending = (id) => setPending((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const addPending = () => {
    if (activeTab !== "custom" && pending.length) setDraftIds((current) => ({ ...current, [activeTab]: Array.from(new Set([...current[activeTab], ...pending])) }));
    setPending([]);
  };
  const addCustom = (event) => {
    event.preventDefault();
    if (!customDraft.title.trim() || !customDraft.content.trim()) return;
    const item = { id: `custom-${Date.now()}`, title: customDraft.title.trim(), content: customDraft.content.trim(), category: "Custom content" };
    setCustomSources((current) => [...current, item]); setCustomDraft({ title: "", content: "" }); setModal(null);
  };
  const removeSource = (item) => {
    if (item.sourceType === "custom") setCustomSources((current) => current.filter((entry) => entry.id !== item.id));
    else setDraftIds((current) => ({ ...current, [item.sourceType === "policy" ? "policies" : `${item.sourceType}s`]: current[item.sourceType === "policy" ? "policies" : `${item.sourceType}s`].filter((id) => id !== item.id) }));
  };

  return <s-page heading="Knowledge library" inlineSize="large">
    <s-button slot="primary-action" variant="primary" disabled={fetcher.state === "submitting"} onClick={() => setConfirmSave(true)}><AdminIcon name="save"/>{fetcher.state === "submitting" ? "Saving…" : "Save and index"}</s-button><AdminPageHeader title="RAG knowledge library" description="Choose trusted Shopify content and support notes for your concierge. Save to refresh the searchable knowledge base." metrics={[{ label: "Selected sources", value: selectedCount }, { label: "Products", value: draftIds.products.length }, { label: "Policies & pages", value: draftIds.policies.length + draftIds.pages.length }, { label: "Custom notes", value: customSources.length }]} />
    <fetcher.Form id="rag-save-form" method="post"><input type="hidden" name="productIds" value={JSON.stringify(draftIds.products)}/><input type="hidden" name="collectionIds" value={JSON.stringify(draftIds.collections)}/><input type="hidden" name="pageIds" value={JSON.stringify(draftIds.pages)}/><input type="hidden" name="policyIds" value={JSON.stringify(draftIds.policies)}/><input type="hidden" name="customSources" value={JSON.stringify(customSources)}/></fetcher.Form>
    <div className="rag-workspace">
      <aside className="rag-library-panel"><div className="rag-panel-heading"><div><span className="rag-eyebrow">YOUR KNOWLEDGE BASE</span><h2>Selected sources</h2><p>{selectedCount} {selectedCount === 1 ? "source" : "sources"} ready for indexing</p></div><span className="rag-count">{selectedCount}</span></div>
        <div className="rag-selected-list">{selectedPageItems.map((item) => <article className="rag-selected-card" key={`${item.sourceType}-${item.id}`}><span className={`rag-source-icon ${item.sourceType}`}>{item.sourceType === "product" ? "P" : item.sourceType === "collection" ? "C" : item.sourceType === "policy" ? "§" : item.sourceType === "custom" ? "✎" : "↗"}</span><div className="rag-card-copy"><strong>{sourceUrl(item) ? <a className="rag-source-link" href={sourceUrl(item)} target="_blank" rel="noreferrer">{item.title}<span aria-hidden="true">↗</span></a> : item.title}</strong><small><span className={`rag-type-badge ${item.sourceType}`}>{item.sourceType === "custom" ? "Custom" : item.sourceType}</span>{item.handle ? <span className="rag-source-handle">/{item.handle}</span> : null}</small></div><button className="rag-remove" type="button" aria-label={`Remove ${item.title}`} title="Remove from library" onClick={() => removeSource(item)}>×</button></article>)}{!selectedCount && <div className="rag-empty"><span className="rag-empty-mark">✦</span><strong>Your library is ready</strong><p>Add trusted store knowledge to help your concierge answer with confidence.</p></div>}</div>
        {selectedCount > pageSize && <div className="rag-library-pagination"><span>{(selectedPageIndex - 1) * pageSize + 1}–{Math.min(selectedPageIndex * pageSize, selectedCount)} of {selectedCount}</span><div className="rag-pagination"><button className="admin-secondary" type="button" disabled={selectedPageIndex <= 1} onClick={() => setSelectedPage((page) => Math.max(1, page - 1))}>← Previous</button><span>Page {selectedPageIndex} of {selectedPageCount}</span><button className="admin-secondary" type="button" disabled={selectedPageIndex >= selectedPageCount} onClick={() => setSelectedPage((page) => Math.min(selectedPageCount, page + 1))}>Next →</button></div></div>}
      </aside>
      <section className="rag-browser-panel"><div className="rag-browser-heading"><div><span className="rag-eyebrow">BROWSE STORE CONTENT</span><h2>Add knowledge</h2><p>Choose content to add to your concierge library.</p></div>{activeTab === "custom" ? <button className="admin-cta" type="button" onClick={() => setModal("custom")}><AdminIcon name="plus"/> Create content</button> : <div className="rag-header-actions"><button className="admin-secondary" type="button" onClick={() => setPending(pending.length === pageItems.length ? [] : pageItems.filter((item) => !(draftIds[activeTab] || []).includes(item.id)).map((item) => item.id))}><AdminIcon name={pending.length === pageItems.filter((item) => !(draftIds[activeTab] || []).includes(item.id)).length ? "close" : "check"}/>{pending.length === pageItems.filter((item) => !(draftIds[activeTab] || []).includes(item.id)).length ? "Clear page selection" : "Select page"}</button><button className="admin-cta" type="button" disabled={!pending.length} onClick={addPending}><AdminIcon name="plus"/> Add selected{pending.length ? ` · ${pending.length}` : ""}</button></div>}</div>
        <div className="rag-tabs" role="tablist" aria-label="Knowledge source types">{tabs.map(([id, label, icon]) => <button key={id} className={`rag-tab ${activeTab === id ? "active" : ""}`} role="tab" aria-selected={activeTab === id} type="button" onClick={() => { setActiveTab(id); setPending([]); setPageNumber(1); }}><span>{icon}</span>{label}</button>)}</div>
        <div className="rag-tab-content"><div className="rag-content-top"><div><strong>{activeLabels[activeTab]}</strong><span>{currentItems.length} available</span></div>{activeTab !== "custom" && <span className="rag-selection-hint">{pending.length} selected</span>}</div>
          {activeTab === "custom" ? <div className="rag-custom-prompt"><span className="rag-empty-mark">✎</span><strong>Add your own trusted content</strong><p>Create sizing notes, care guides, support instructions, or other information that is not in Shopify.</p><button className="admin-cta" type="button" onClick={() => setModal("custom")}><AdminIcon name="plus"/> Create custom content</button></div> : currentItems.length ? <><div className="rag-source-grid">{pageItems.map((item) => { const chosen = (draftIds[activeTab] || []).includes(item.id); const checked = pending.includes(item.id); const sourceType = activeTab === "products" ? "product" : activeTab === "collections" ? "collection" : activeTab === "policies" ? "policy" : "page"; return <article key={item.id} className={`rag-source-card ${chosen ? "is-added" : ""} ${checked ? "is-checked" : ""}`}><div className="rag-card-top"><label className="rag-select-control"><input type="checkbox" checked={checked} disabled={chosen} onChange={() => togglePending(item.id)} aria-label={`Select ${item.title}`}/><span>{chosen ? "Added" : checked ? "Selected" : "Select"}</span></label><span className={`rag-status ${chosen ? "added" : "available"}`}>{chosen ? "In library" : "Available"}</span></div><strong>{sourceUrl({ ...item, sourceType }) ? <a className="rag-source-link" href={sourceUrl({ ...item, sourceType })} target="_blank" rel="noreferrer">{item.title}<span aria-hidden="true">↗</span></a> : item.title}</strong><small>{activeTab === "products" ? `${item.vendor || "Store product"} · ${item.status.toLowerCase()}` : activeTab === "collections" ? `${item.productsCount?.count || 0} products` : `/${item.handle}`}</small>{!chosen && <button className="rag-card-action" type="button" onClick={() => { setDraftIds((current) => ({ ...current, [activeTab]: [...current[activeTab], item.id] })); setPending((current) => current.filter((id) => id !== item.id)); }}><AdminIcon name="plus"/> Add to library</button>}{chosen && <button className="rag-card-action added" type="button" onClick={() => removeSource({ ...item, sourceType })}><AdminIcon name="trash"/> Remove from library</button>}</article>; })}</div><div className="rag-bulk-action"><span>Showing {Math.min((pageNumber - 1) * pageSize + 1, currentItems.length)}–{Math.min(pageNumber * pageSize, currentItems.length)} of {currentItems.length} · {pending.length} selected</span><div className="rag-pagination"><button className="admin-secondary" type="button" disabled={pageNumber <= 1} onClick={() => { setPageNumber((page) => page - 1); setPending([]); }}>← Previous</button><span>Page {pageNumber} of {pageCount}</span><button className="admin-secondary" type="button" disabled={pageNumber >= pageCount} onClick={() => { setPageNumber((page) => page + 1); setPending([]); }}>Next →</button></div></div></> : <div className="rag-empty rag-empty-inline"><span className="rag-empty-mark">⌕</span><strong>No {activeLabels[activeTab]} found</strong><p>When you add store content in Shopify, it will appear here.</p></div>}
        </div>
      </section>
    </div>
    {modal === "custom" && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="rag-custom-title"><header className="admin-modal-header"><div><span className="admin-modal-kicker">CUSTOM STORE KNOWLEDGE</span><h2 id="rag-custom-title">Add custom content</h2><p>Write guidance your concierge can use when helping shoppers.</p></div><button className="admin-modal-x" type="button" onClick={() => setModal(null)} aria-label="Close">×</button></header><form onSubmit={addCustom}><label className="admin-field">Content title<input className="admin-text-input" value={customDraft.title} onChange={(event) => setCustomDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Jacket sizing advice" required/></label><label className="admin-field">Content<textarea className="admin-text-input admin-textarea" value={customDraft.content} onChange={(event) => setCustomDraft((current) => ({ ...current, content: event.target.value }))} placeholder="Add helpful details, instructions, or answers…" required/></label><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setModal(null)}><AdminIcon name="close"/> Cancel</button><button className="admin-cta" type="submit"><AdminIcon name="plus"/> Add to library</button></footer></form></section></div>}
    {confirmSave && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmSave(false)}><section className="admin-modal admin-confirm-modal rag-save-modal" role="dialog" aria-modal="true" aria-labelledby="rag-save-title"><div className="admin-confirm-icon"><AdminIcon name="save" size={21}/></div><span className="admin-modal-kicker">KNOWLEDGE LIBRARY</span><h2 id="rag-save-title">Save these sources?</h2><p>Your concierge will use the selected Shopify content and custom notes when answering customer questions.</p><div className="rag-save-summary"><span><strong>{selectedCount}</strong> total sources</span><span><strong>{draftIds.products.length}</strong> products</span><span><strong>{draftIds.collections.length}</strong> collections</span><span><strong>{draftIds.pages.length + draftIds.policies.length}</strong> pages &amp; policies</span><span><strong>{customSources.length}</strong> custom notes</span></div><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setConfirmSave(false)}><AdminIcon name="close"/> Cancel</button><button className="admin-cta" type="submit" form="rag-save-form" disabled={fetcher.state === "submitting"}><AdminIcon name="save"/>{fetcher.state === "submitting" ? "Saving…" : "Confirm and save"}</button></footer></section></div>}
  </s-page>;
}
export const headers = (args) => boundary.headers(args);
