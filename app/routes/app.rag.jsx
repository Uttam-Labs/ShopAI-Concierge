/* eslint-env node */
/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { randomUUID } from "node:crypto";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import { useActionToast } from "../components/AdminToast";
import { embedTexts } from "../gemini.server";
import { resolveEmbeddingKey } from "../ai.server";
import { createSupabaseServerClient, getSupabaseServerConfigIssues, hasSupabaseServerConfig } from "../supabase.server";

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
        shop { shopPolicies { id title type url body } }
      }
    `),
    import("../db.server.js").then((module) => module.default),
  ]);
  const [result, config, documents] = await Promise.all([
    response.json(),
    prisma.knowledgeConfig.findUnique({ where: { shop: session.shop } }),
    prisma.knowledgeDocument.findMany({ where: { shop: session.shop }, select: { id: true, fileName: true, contentType: true, size: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
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
  const policies = data.shop?.shopPolicies ?? [];
  if (result.errors?.length) console.error("Shopify knowledge sources returned GraphQL errors", result.errors);
  const policyLoadError = result.errors?.some((error) => /shop.?policy|read_legal_policies/i.test(String(error.message || "")) || error.path?.includes("shopPolicies"))
    ? "Shopify could not load store policies. This app needs read_legal_policies access. Deploy the updated app permissions, approve them in Shopify, then refresh this page."
    : "";
  const selected = [
    ...products.filter((item) => productIds.includes(item.id)).map((item) => ({ ...item, sourceType: "product" })),
    ...collections.filter((item) => collectionIds.includes(item.id)).map((item) => ({ ...item, sourceType: "collection" })),
    ...pages.filter((item) => pageIds.includes(item.id)).map((item) => ({ ...item, sourceType: "page" })),
    ...policies.filter((item) => policyIds.includes(item.id)).map((item) => ({ ...item, sourceType: "policy" })),
    ...customSources.map((item) => ({ ...item, sourceType: "custom" })),
  ];
  return { products, collections, pages, policies, policyLoadError, productIds, collectionIds, pageIds, policyIds, customSources, selected, documents, shopHandle: session.shop.replace(/\.myshopify\.com$/i, "") };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const prisma = (await import("../db.server.js")).default;
  if (intent === "uploadDocument") {
    const file = form.get("documentFile");
    if (!file || typeof file.arrayBuffer !== "function" || !file.size) return { error: "Choose a document to upload." };
    if (file.size > 10 * 1024 * 1024) return { error: "Each document must be 10 MB or smaller." };
    const fileName = String(file.name || "document").replace(/[\\/]/g, "_").slice(0, 180);
    const extension = fileName.split(".").pop()?.toLowerCase();
    const supported = ["txt", "docx", "xlsx"];
    if (!supported.includes(extension)) return { error: "Use a .txt, .docx, or .xlsx document." };
    const buffer = Buffer.from(await file.arrayBuffer());
    let content = "";
    try {
      if (extension === "txt") content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      else if (extension === "docx") {
        const mammoth = await import("mammoth");
        content = (await mammoth.extractRawText({ buffer })).value;
      } else {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.default.Workbook();
        await workbook.xlsx.load(buffer);
        content = workbook.worksheets.map((sheet) => {
          const rows = [];
          sheet.eachRow({ includeEmpty: false }, (row) => rows.push(row.values.slice(1).map((value) => {
            if (value == null) return "";
            if (typeof value !== "object") return String(value);
            if ("text" in value) return String(value.text || "");
            if ("richText" in value) return value.richText.map((part) => part.text || "").join("");
            if ("result" in value) return String(value.result ?? "");
            return JSON.stringify(value);
          }).join("\t")));
          return `Sheet: ${sheet.name}\n${rows.join("\n")}`;
        }).join("\n\n");
      }
    } catch (error) {
      console.error("Knowledge document parsing failed", error);
      return { error: "We couldn’t read this file. Please check that it is a valid, text-based document." };
    }
    content = content.replace(/\u0000/g, "").trim();
    if (!content) return { error: "This document has no readable text to add." };
    if (content.length > 200_000) return { error: "This document contains too much text. Keep it under 200,000 characters." };
    const id = randomUUID();
    const storagePath = `${session.shop.replace(/[^a-z0-9.-]/gi, "_")}/${id}.${extension}`;
    const supabase = createSupabaseServerClient();
    const contentType = file.type || (extension === "txt" ? "text/plain" : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const { error: bucketError } = await supabase.storage.createBucket("shopai-knowledge-documents", { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] });
    if (bucketError && !/already exists|duplicate/i.test(bucketError.message || "")) {
      console.error("Knowledge document storage bucket setup failed", bucketError);
      return { error: "Document storage could not be prepared. Check the Supabase server credentials." };
    }
    const { error: storageError } = await supabase.storage.from("shopai-knowledge-documents").upload(storagePath, buffer, { contentType, upsert: false });
    if (storageError) {
      console.error("Knowledge document storage failed", storageError);
      return { error: "The document couldn’t be stored. Check the Knowledge Documents storage migration and server credentials." };
    }
    try {
      await prisma.knowledgeDocument.create({ data: { id, shop: session.shop, fileName, storagePath, contentType, size: file.size, content } });
    } catch (error) {
      await supabase.storage.from("shopai-knowledge-documents").remove([storagePath]);
      console.error("Knowledge document record save failed", error);
      return { error: "The document upload could not be saved. Please try again." };
    }
    return { uploaded: fileName };
  }
  if (intent === "readDocument") {
    const document = await prisma.knowledgeDocument.findFirst({ where: { id: String(form.get("documentId") || ""), shop: session.shop }, select: { id: true, fileName: true, content: true } });
    return document ? { readDocument: document } : { error: "That document is no longer available." };
  }
  if (intent === "trainDocuments") {
    const ids = parseList(form.get("documentIds"));
    const documents = await prisma.knowledgeDocument.findMany({ where: { shop: session.shop, id: { in: ids } }, select: { id: true, fileName: true, content: true } });
    return { trainingDocuments: documents.map((document) => ({ id: `document-${document.id}`, documentId: document.id, title: document.fileName, content: document.content, category: "Uploaded document" })) };
  }
  if (intent === "deleteDocument") {
    const id = String(form.get("documentId") || "");
    const document = await prisma.knowledgeDocument.findFirst({ where: { id, shop: session.shop } });
    if (!document) return { error: "That document is no longer available." };
    const supabase = createSupabaseServerClient();
    const { error: storageError } = await supabase.storage.from("shopai-knowledge-documents").remove([document.storagePath]);
    if (storageError) return { error: "The document file couldn’t be deleted. Please try again." };
    await prisma.knowledgeDocument.delete({ where: { id: document.id } });
    const config = await prisma.knowledgeConfig.findUnique({ where: { shop: session.shop } });
    const customSources = (config?.customSources || []).filter((item) => item.documentId !== document.id);
    if (config) await prisma.knowledgeConfig.update({ where: { shop: session.shop }, data: { customSources } });
    const { error: vectorError } = await supabase.from("shopai_knowledge").delete().eq("shop_domain", session.shop).eq("source_type", "custom").like("source_id", `document-${document.id}-chunk-%`);
    if (vectorError) console.error("Deleted document vectors could not be removed", vectorError);
    return { deletedDocumentId: document.id };
  }
  const productIds = parseList(form.get("productIds"));
  const collectionIds = parseList(form.get("collectionIds"));
  const pageIds = parseList(form.get("pageIds"));
  const policyIds = parseList(form.get("policyIds"));
  const customSources = parseList(form.get("customSources"));
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
  const prismaSettings = await prisma.assistantSettings.findUnique({ where: { shop: session.shop }, select: { aiProvider: true, aiApiKeyEncrypted: true } });
  const embeddingKey = resolveEmbeddingKey(prismaSettings);
  if (!embeddingKey || !hasSupabaseServerConfig()) {
    const missing = getSupabaseServerConfigIssues();
    const needsGemini = !embeddingKey ? (prismaSettings?.aiProvider === "gemini" ? "Connect Google Gemini in Assistant settings" : "add GEMINI_API_KEY to Vercel for free Gemini embeddings") : "";
    const required = [...(needsGemini ? [needsGemini] : []), ...missing];
    return { saved: true, indexed: false, selectedCount: productIds.length + collectionIds.length + pageIds.length + policyIds.length + customSources.length, indexingWarning: `Your sources are saved. Indexing will start after this missing setup is added in Vercel: ${required.join(", ")}. Redeploy, then click Save and index again.` };
  }
  let indexingStage = "Shopify content";
  try {
    const supabase = createSupabaseServerClient();
    const docs = [];
    const resolvedShopifyIds = new Set();
    const batches = (ids, size) => Array.from({ length: Math.ceil(ids.length / size) }, (_, index) => ids.slice(index * size, (index + 1) * size));
    const knowledgeBatches = [...batches(productIds, 5), ...batches(collectionIds, 1), ...batches(pageIds, 50)];
    for (const ids of knowledgeBatches) {
      const result = await admin.graphql(`#graphql
        query SelectedKnowledge($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id title descriptionHtml vendor productType tags
              featuredMedia { ... on MediaImage { image { url } } }
              variants(first: 100) { edges { node { id title sku price availableForSale selectedOptions { name value } } } }
              metafields(first: 50) { nodes { namespace key value type } }
              collections(first: 20) { nodes { title handle } }
            }
            ... on Collection {
              id title handle description image { url }
              products(first: 30) { edges { node { id title handle descriptionHtml vendor productType tags featuredMedia { ... on MediaImage { image { url } } } variants(first: 20) { edges { node { id title sku price availableForSale selectedOptions { name value } } } } metafields(first: 10) { nodes { namespace key value type } } } } }
            }
            ... on Page { id title body handle }
          }
        }
      `, { variables: { ids } });
      const payload = await result.json();
      if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join("; "));
      const nodes = payload.data?.nodes ?? [];
      for (const node of nodes) {
        if (!node) continue;
        resolvedShopifyIds.add(node.id);
        if (node.variants) {
          const description = node.descriptionHtml?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
          const tags = node.tags || [];
          const variants = node.variants.edges?.map(({ node: variant }) => variant) || [];
          const metafields = node.metafields?.nodes || [];
          const collections = node.collections?.nodes || [];
          docs.push({
            source_type: "product",
            source_id: node.id,
            title: node.title,
            content: [node.title, `Handle: ${node.handle}`, `Tags: ${tags.join(", ")}`, `Collections: ${collections.map((collection) => `${collection.title} (${collection.handle})`).join(", ")}`, ...metafields.map((field) => `Metafield ${field.namespace}.${field.key}: ${String(field.value || "").slice(0, 300)}`), ...variants.map((variant) => `${variant.title} SKU ${variant.sku || ""} $${variant.price} ${variant.availableForSale ? "in stock" : "out of stock"} ${variant.selectedOptions?.map((option) => `${option.name} ${option.value}`).join(" ") || ""}`), node.vendor, node.productType, description.slice(0, 1800)].filter(Boolean).join("\n"),
            metadata: { handle: node.handle, image: node.featuredMedia?.image?.url, description, vendor: node.vendor || "", productType: node.productType || "", tags, collections, metafields, variants },
          });
        }
        else if (node.products) {
          const collectionProducts = (node.products.edges ?? []).map(({ node: product }) => ({
            id: product.id,
            title: product.title,
            handle: product.handle,
            image: product.featuredMedia?.image?.url || "",
            vendor: product.vendor || "",
            productType: product.productType || "",
            description: product.descriptionHtml?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "",
            tags: product.tags || [],
            metafields: product.metafields?.nodes || [],
            variants: (product.variants?.edges ?? []).map(({ node: variant }) => ({ id: variant.id, title: variant.title, sku: variant.sku, price: variant.price, availableForSale: variant.availableForSale, selectedOptions: variant.selectedOptions || [] })),
            collections: [{ title: node.title, handle: node.handle }],
          }));
          for (const product of collectionProducts) {
            const variantText = product.variants.map((variant) => `${variant.title} SKU ${variant.sku || ""} $${variant.price} ${variant.availableForSale ? "in stock" : "out of stock"} ${variant.selectedOptions?.map((option) => `${option.name} ${option.value}`).join(" ") || ""}`);
            docs.push({ source_type: "product", source_id: product.id, title: product.title, content: [product.title, `Handle: ${product.handle}`, `Tags: ${product.tags.join(", ")}`, `Collection: ${node.title} (${node.handle})`, ...product.metafields.map((field) => `Metafield ${field.namespace}.${field.key}: ${String(field.value || "").slice(0, 300)}`), ...variantText, product.vendor, product.productType, product.description.slice(0, 1800)].filter(Boolean).join("\n"), metadata: { handle: product.handle, image: product.image, description: product.description, vendor: product.vendor, productType: product.productType, tags: product.tags, collections: product.collections, metafields: product.metafields, variants: product.variants } });
          }
          docs.push({
            source_type: "collection",
            source_id: node.id,
            title: node.title,
            content: [node.title, `Collection handle: ${node.handle}`, node.description, ...collectionProducts.map((product) => [product.title, `Handle: ${product.handle}`, product.vendor, product.productType, product.description, `Tags: ${product.tags.join(", ")}`, `Collection: ${node.title} (${node.handle})`, ...product.variants.map((variant) => `${variant.title} SKU ${variant.sku || ""} $${variant.price} ${variant.availableForSale ? "in stock" : "out of stock"} ${variant.selectedOptions?.map((option) => `${option.name} ${option.value}`).join(" ") || ""}`)].filter(Boolean).join("\n"))].filter(Boolean).join("\n"),
            metadata: { handle: node.handle, image: node.image?.url, products: collectionProducts },
          });
        }
        else docs.push({ source_type: policyIds.includes(node.id) ? "policy" : "page", source_id: node.id, title: node.title, content: `${node.title}\n${node.body?.replace(/<[^>]+>/g, " ") || ""}`, metadata: { handle: node.handle } });
      }
    }
    for (const item of customSources) {
      if (item.documentId) {
        const paragraphs = String(item.content || "").split(/\n+/);
        const chunks = [];
        let chunk = "";
        for (const paragraph of paragraphs) {
          const value = paragraph.trim();
          if (!value) continue;
          if (chunk && chunk.length + value.length + 1 > 4500) { chunks.push(chunk); chunk = ""; }
          if (value.length > 4500) {
            if (chunk) chunks.push(chunk);
            for (let offset = 0; offset < value.length; offset += 4500) chunks.push(value.slice(offset, offset + 4500));
            chunk = "";
          } else chunk = chunk ? `${chunk}\n${value}` : value;
        }
        if (chunk) chunks.push(chunk);
        chunks.forEach((content, index) => docs.push({ source_type: "custom", source_id: `${item.id}-chunk-${index + 1}`, title: chunks.length > 1 ? `${item.title} · part ${index + 1}` : item.title, content, metadata: { category: item.category || "Uploaded document", document_id: item.documentId, document_name: item.title, part: index + 1, total_parts: chunks.length } }));
      } else docs.push({ source_type: "custom", source_id: item.id, title: item.title, content: item.content, metadata: { category: item.category || "Custom content" } });
    }
    const selectedPolicyIds = new Set(policyIds);
    const policyResponse = policyIds.length ? await admin.graphql(`#graphql
      query SelectedStorePolicies {
        shop { shopPolicies { id title type url body } }
      }
    `) : null;
    const policyResult = policyResponse ? await policyResponse.json() : null;
    if (policyResult?.errors?.length) throw new Error(`Shopify policy lookup failed: ${policyResult.errors.map((error) => error.message).join("; ")}`);
    const selectedPolicies = (policyResult?.data?.shop?.shopPolicies ?? []).filter((policy) => selectedPolicyIds.has(policy.id));
    selectedPolicies.forEach((policy) => resolvedShopifyIds.add(policy.id));
    for (const policy of selectedPolicies) {
      const policyText = policy.body?.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, "> ").replace(/&quot;/gi, '"').trim() || "";
      if (policyText) docs.push({ source_type: "policy", source_id: policy.id, title: policy.title || policy.type?.replaceAll("_", " ") || "Store policy", content: `${policy.title || "Store policy"}\n${policyText}`, metadata: { url: policy.url, policy_type: policy.type } });
    }
    const docsBySource = new Map();
    for (const doc of docs) {
      const key = `${doc.source_type}:${doc.source_id}`;
      const existing = docsBySource.get(key);
      if (!existing) docsBySource.set(key, doc);
      else if (doc.source_type === "product") {
        const richer = (doc.metadata?.metafields?.length || 0) > (existing.metadata?.metafields?.length || 0) ? doc : existing;
        const collections = [...(existing.metadata?.collections || []), ...(doc.metadata?.collections || [])].filter((item, index, list) => item?.handle && list.findIndex((candidate) => candidate?.handle === item.handle) === index);
        docsBySource.set(key, { ...richer, metadata: { ...richer.metadata, collections } });
      }
    }
    const uniqueDocs = [...docsBySource.values()];
    const rows = [];
    for (let i = 0; i < uniqueDocs.length; i += 100) {
      const batch = uniqueDocs.slice(i, i + 100);
      indexingStage = "Gemini embeddings";
      const embeddings = await embedTexts(batch.map((doc) => `${doc.title}\n${doc.content}`.slice(0, 6000)), "RETRIEVAL_DOCUMENT", embeddingKey);
      batch.forEach((doc, index) => rows.push({ ...doc, metadata: { ...doc.metadata, embedding_model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001" }, shop_domain: session.shop, embedding: embeddings[index] }));
    }
    if (rows.length) {
      indexingStage = "Supabase vector save";
      const { error } = await supabase.from("shopai_knowledge").upsert(rows, { onConflict: "shop_domain,source_type,source_id" });
      if (error) throw error;
    }
    indexingStage = "Supabase index cleanup";
    const retainedSources = new Set(rows.map((row) => `${row.source_type}:${row.source_id}`));
    const { data: existingSources, error: readError } = await supabase.from("shopai_knowledge").select("id,source_type,source_id").eq("shop_domain", session.shop);
    if (readError) throw readError;
    const staleIds = (existingSources || []).filter((row) => row.source_type !== "flow" && !retainedSources.has(`${row.source_type}:${row.source_id}`)).map((row) => row.id);
    for (let offset = 0; offset < staleIds.length; offset += 500) {
      const { error } = await supabase.from("shopai_knowledge").delete().eq("shop_domain", session.shop).in("id", staleIds.slice(offset, offset + 500));
      if (error) throw error;
    }
    const validProductIds = productIds.filter((id) => resolvedShopifyIds.has(id));
    const validCollectionIds = collectionIds.filter((id) => resolvedShopifyIds.has(id));
    const validPageIds = pageIds.filter((id) => resolvedShopifyIds.has(id));
    const validPolicyIds = policyIds.filter((id) => resolvedShopifyIds.has(id));
    await prisma.knowledgeConfig.update({ where: { shop: session.shop }, data: { productIds: validProductIds, collectionIds: validCollectionIds, pageIds: validPageIds, policyIds: validPolicyIds } });
    return { saved: true, indexed: true, indexedCount: rows.length, removedCount: staleIds.length, selectedCount: validProductIds.length + validCollectionIds.length + validPageIds.length + validPolicyIds.length + customSources.length };
  } catch (error) {
    console.error("Knowledge indexing failed", error);
    const detail = String(error?.message || "");
    const code = String(error?.code || "");
    const policyAccessError = /shop.?policy|read_legal_policies|policy lookup/i.test(detail);
    let indexingWarning;
    if (policyAccessError) indexingWarning = "Your sources were saved, but Shopify could not read the selected policies. Deploy and approve the app’s read_legal_policies permission, then save and index again.";
    else if (indexingStage === "Gemini embeddings") {
      if (/\b(401|403)\b|invalid.*key|api key.*invalid|permission denied/i.test(detail)) indexingWarning = "Your sources were saved, but Gemini rejected the saved API key. Reconnect Google Gemini in Assistant settings, then save and index again.";
      else if (/\b429\b|quota|resource.?exhausted|rate.?limit/i.test(detail)) indexingWarning = "Your sources were saved, but Gemini’s free embedding quota is temporarily unavailable. Wait for quota to reset or try again later.";
      else indexingWarning = "Your sources were saved, but Gemini could not create search vectors. Reconnect Gemini and check that the embedding model is available to your key.";
    } else if (indexingStage.startsWith("Supabase")) {
      if (/\b(401|403)\b|permission denied|invalid api key/i.test(detail)) indexingWarning = "Your sources were saved, but Supabase rejected the server key. Use this project’s Secret/service_role key in Vercel, redeploy, then try again.";
      else if (/PGRST202|PGRST205|does not exist|schema cache|match_knowledge/i.test(`${code} ${detail}`)) indexingWarning = "Your sources were saved, but the vector database schema is not available to the app yet. Apply the latest Supabase migrations, then save and index again.";
      else indexingWarning = "Your sources were saved, but Supabase could not store the search vectors. Check this project’s table permissions and database logs.";
    } else indexingWarning = "Your sources were saved, but Shopify could not load all selected content. Refresh the library and try again.";
    return { saved: true, indexed: false, indexingWarning };
  }
};

const tabs = [
  ["products", "Products", "P"], ["collections", "Collections", "C"], ["pages", "Pages", "↗"], ["policies", "Policies", "§"], ["custom", "Custom content", "+"], ["documents", "Documents", "▤"],
];

export default function RagSettings({ loaderData }) {
  const fetcher = useFetcher();
  const documentFetcher = useFetcher();
  useActionToast(fetcher);
  const [activeTab, setActiveTab] = useState("products");
  const [modal, setModal] = useState(null);
  const [draftIds, setDraftIds] = useState({ products: loaderData.productIds, collections: loaderData.collectionIds, pages: loaderData.pageIds, policies: loaderData.policyIds });
  const [customSources, setCustomSources] = useState(loaderData.customSources);
  const [pending, setPending] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedPage, setSelectedPage] = useState(1);
  const [customDraft, setCustomDraft] = useState({ title: "", content: "" });
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [syncAfterTraining, setSyncAfterTraining] = useState(false);
  const handledTraining = useRef("");
  const handledRead = useRef("");

  useEffect(() => {
    const docs = documentFetcher.data?.trainingDocuments;
    if (!docs?.length) return;
    if (handledTraining.current === documentFetcher.data) return;
    handledTraining.current = documentFetcher.data;
    setCustomSources((current) => [...current.filter((item) => !docs.some((doc) => doc.id === item.id)), ...docs]);
    setSyncAfterTraining(true);
  }, [documentFetcher.data]);

  useEffect(() => {
    const document = documentFetcher.data?.readDocument;
    if (!document || handledRead.current === documentFetcher.data) return;
    handledRead.current = documentFetcher.data;
    setModal({ type: "read", document });
  }, [documentFetcher.data]);

  useEffect(() => {
    const id = documentFetcher.data?.deletedDocumentId;
    if (id) setCustomSources((current) => current.filter((item) => item.documentId !== id));
  }, [documentFetcher.data]);

  useEffect(() => {
    if (!syncAfterTraining || fetcher.state !== "idle") return;
    const form = document.getElementById("rag-save-form");
    if (form instanceof HTMLFormElement) {
      setSyncAfterTraining(false);
      form.requestSubmit();
    }
  }, [syncAfterTraining, fetcher.state, customSources]);

  const currentItems = useMemo(() => ({ products: loaderData.products, collections: loaderData.collections, pages: loaderData.pages, policies: loaderData.policies, custom: customSources, documents: loaderData.documents }[activeTab] || []), [activeTab, loaderData, customSources]);
  const trainedDocuments = new Set(customSources.filter((item) => item.documentId).map((item) => item.documentId));
  const selectedCount = draftIds.products.length + draftIds.collections.length + draftIds.pages.length + draftIds.policies.length + customSources.length;
  const activeLabels = { products: "products", collections: "collections", pages: "pages", policies: "policies", custom: "custom content", documents: "documents" };
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
    if (item.sourceType === "policy") return `${adminBase}/settings/policies`;
    if (item.sourceType === "page") return `${adminBase}/pages/${encodeURIComponent(resourceId)}`;
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

  const syncing = fetcher.state !== "idle" || documentFetcher.state !== "idle";
  const syncLatest = () => {
    const form = document.getElementById("rag-save-form");
    if (form instanceof HTMLFormElement && !syncing) form.requestSubmit();
  };

  return <s-page heading="Knowledge Source" inlineSize="large">
    <s-button slot="primary-action" variant="primary" disabled={syncing} onClick={syncLatest}><AdminIcon name="save"/>{syncing ? "Syncing latest data…" : "Sync latest data"}</s-button><AdminPageHeader title="Knowledge Source" description="Choose the trusted store information your concierge can use to answer shoppers." metrics={[{ label: "Selected sources", value: selectedCount }, { label: "Products", value: draftIds.products.length }, { label: "Policies & pages", value: draftIds.policies.length + draftIds.pages.length }, { label: "Custom notes & documents", value: customSources.length }]} />
    {syncing && <section className="rag-sync-progress" role="status" aria-live="polite"><span className="rag-sync-spinner" aria-hidden="true"/><div className="rag-sync-copy"><strong>Refreshing your knowledge library</strong><p>Loading the latest selected Shopify data, rebuilding search vectors, and removing outdated entries.</p><div className="rag-sync-track" role="progressbar" aria-label="Knowledge library sync in progress"><span/></div></div></section>}
    <fetcher.Form id="rag-save-form" method="post"><input type="hidden" name="productIds" value={JSON.stringify(draftIds.products)}/><input type="hidden" name="collectionIds" value={JSON.stringify(draftIds.collections)}/><input type="hidden" name="pageIds" value={JSON.stringify(draftIds.pages)}/><input type="hidden" name="policyIds" value={JSON.stringify(draftIds.policies)}/><input type="hidden" name="customSources" value={JSON.stringify(customSources)}/></fetcher.Form>
    <div className="rag-workspace">
      <aside className="rag-library-panel"><div className="rag-panel-heading"><div><span className="rag-eyebrow">YOUR KNOWLEDGE BASE</span><h2>Selected sources</h2><p>{selectedCount} {selectedCount === 1 ? "source" : "sources"} ready for indexing</p></div><span className="rag-count">{selectedCount}</span></div>
        <div className="rag-selected-list">{selectedPageItems.map((item) => <article className="rag-selected-card" key={`${item.sourceType}-${item.id}`}><span className={`rag-source-icon ${item.sourceType}`}>{item.sourceType === "product" ? "P" : item.sourceType === "collection" ? "C" : item.sourceType === "policy" ? "§" : item.documentId ? "▤" : item.sourceType === "custom" ? "✎" : "↗"}</span><div className="rag-card-copy"><strong>{sourceUrl(item) ? <a className="rag-source-link" href={sourceUrl(item)} target="_blank" rel="noreferrer">{item.title}<span aria-hidden="true">↗</span></a> : item.title}</strong><small><span className={`rag-type-badge ${item.sourceType}`}>{item.documentId ? "Document" : item.sourceType === "custom" ? "Custom" : item.sourceType}</span>{item.sourceType === "policy" && item.type ? <span className="rag-source-handle">{item.type.replaceAll("_", " ").toLowerCase()}</span> : item.handle ? <span className="rag-source-handle">/{item.handle}</span> : null}</small></div><button className="rag-remove" type="button" aria-label={`Remove ${item.title}`} title="Remove from library" onClick={() => removeSource(item)}>×</button></article>)}{!selectedCount && <div className="rag-empty"><span className="rag-empty-mark">✦</span><strong>Your library is ready</strong><p>Add trusted store knowledge to help your concierge answer with confidence.</p></div>}</div>
        {selectedCount > pageSize && <div className="rag-library-pagination"><span>{(selectedPageIndex - 1) * pageSize + 1}–{Math.min(selectedPageIndex * pageSize, selectedCount)} of {selectedCount}</span><div className="rag-pagination"><button className="admin-secondary" type="button" disabled={selectedPageIndex <= 1} onClick={() => setSelectedPage((page) => Math.max(1, page - 1))}>← Previous</button><span>Page {selectedPageIndex} of {selectedPageCount}</span><button className="admin-secondary" type="button" disabled={selectedPageIndex >= selectedPageCount} onClick={() => setSelectedPage((page) => Math.min(selectedPageCount, page + 1))}>Next →</button></div></div>}
      </aside>
      <section className="rag-browser-panel"><div className="rag-browser-heading"><div><span className="rag-eyebrow">BROWSE STORE CONTENT</span><h2>Add knowledge</h2><p>Choose content to add to your concierge library.</p></div>{activeTab === "custom" ? <button className="admin-cta" type="button" onClick={() => setModal("custom")}><AdminIcon name="plus"/> Create content</button> : activeTab === "documents" ? <div className="rag-header-actions"><button className="admin-secondary" type="button" disabled={!pendingDocuments.length || documentFetcher.state !== "idle"} onClick={() => documentFetcher.submit({ intent: "trainDocuments", documentIds: JSON.stringify(pendingDocuments) }, { method: "post" })}><AdminIcon name="plus"/> Add to training{pendingDocuments.length ? ` · ${pendingDocuments.length}` : ""}</button></div> : <div className="rag-header-actions"><button className="admin-secondary" type="button" onClick={() => setPending(pending.length === pageItems.length ? [] : pageItems.filter((item) => !(draftIds[activeTab] || []).includes(item.id)).map((item) => item.id))}><AdminIcon name={pending.length === pageItems.filter((item) => !(draftIds[activeTab] || []).includes(item.id)).length ? "close" : "check"}/>{pending.length === pageItems.filter((item) => !(draftIds[activeTab] || []).includes(item.id)).length ? "Clear page selection" : "Select page"}</button><button className="admin-cta" type="button" disabled={!pending.length} onClick={addPending}><AdminIcon name="plus"/> Add selected{pending.length ? ` · ${pending.length}` : ""}</button></div>}</div>
        <div className="rag-tabs" role="tablist" aria-label="Knowledge source types">{tabs.map(([id, label, icon]) => <button key={id} className={`rag-tab ${activeTab === id ? "active" : ""}`} role="tab" aria-selected={activeTab === id} type="button" onClick={() => { setActiveTab(id); setPending([]); setPendingDocuments([]); setPageNumber(1); }}><span>{icon}</span>{label}</button>)}</div>
        <div className="rag-tab-content"><div className="rag-content-top"><div><strong>{activeLabels[activeTab]}</strong><span>{currentItems.length} available</span></div>{activeTab === "documents" ? <span className="rag-selection-hint">{pendingDocuments.length} selected</span> : activeTab !== "custom" && <span className="rag-selection-hint">{pending.length} selected</span>}</div>
          {activeTab === "custom" ? <div className="rag-custom-prompt"><span className="rag-empty-mark">✎</span><strong>Add your own trusted content</strong><p>Create sizing notes, care guides, support instructions, or other information that is not in Shopify.</p><button className="admin-cta" type="button" onClick={() => setModal("custom")}><AdminIcon name="plus"/> Create custom content</button></div> : activeTab === "documents" ? <div className="rag-document-library"><documentFetcher.Form method="post" encType="multipart/form-data" className="rag-document-upload"><input type="hidden" name="intent" value="uploadDocument"/><label className="admin-field">Upload a document<input className="admin-text-input" type="file" name="documentFile" accept=".txt,.docx,.xlsx" required/></label><small>TXT, Word (.docx), and Excel (.xlsx), up to 10 MB each.</small><button className="admin-cta" type="submit" disabled={documentFetcher.state !== "idle"}><AdminIcon name="plus"/>{documentFetcher.state !== "idle" ? "Working…" : "Upload document"}</button></documentFetcher.Form>{documentFetcher.data?.error && <p className="rag-document-message error" role="alert">{documentFetcher.data.error}</p>}{documentFetcher.data?.uploaded && <p className="rag-document-message" role="status">{documentFetcher.data.uploaded} uploaded. Select it below to add it to training.</p>}{currentItems.length ? <div className="rag-source-grid">{currentItems.map((item) => { const trained = trainedDocuments.has(item.id); const checked = pendingDocuments.includes(item.id); return <article key={item.id} className={`rag-source-card ${trained ? "is-added" : ""} ${checked ? "is-checked" : ""}`}><div className="rag-card-top"><label className="rag-select-control"><input type="checkbox" checked={checked} disabled={trained} onChange={() => setPendingDocuments((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} aria-label={`Select ${item.fileName} for training`}/><span>{trained ? "In training" : checked ? "Selected" : "Select"}</span></label><span className={`rag-status ${trained ? "added" : "available"}`}>{trained ? "Trained" : "Uploaded"}</span></div><strong>{item.fileName}</strong><small>{(item.size / 1024).toFixed(1)} KB · {new Date(item.createdAt).toLocaleDateString()}</small><div className="rag-document-actions"><button className="rag-card-action" type="button" disabled={documentFetcher.state !== "idle"} onClick={() => documentFetcher.submit({ intent: "readDocument", documentId: item.id }, { method: "post" })}>Read</button><button className="rag-card-action" type="button" disabled={documentFetcher.state !== "idle"} onClick={() => { if (window.confirm(`Delete ${item.fileName}?`)) documentFetcher.submit({ intent: "deleteDocument", documentId: item.id }, { method: "post" }); }}>Delete</button></div></article>; })}</div> : <div className="rag-empty rag-empty-inline"><span className="rag-empty-mark">▤</span><strong>No documents uploaded</strong><p>Upload a text, Word, or Excel file. Then select it and add it to training.</p></div>}</div> : currentItems.length ? <><div className="rag-source-grid">{pageItems.map((item) => { const chosen = (draftIds[activeTab] || []).includes(item.id); const checked = pending.includes(item.id); const sourceType = activeTab === "products" ? "product" : activeTab === "collections" ? "collection" : activeTab === "policies" ? "policy" : "page"; return <article key={item.id} className={`rag-source-card ${chosen ? "is-added" : ""} ${checked ? "is-checked" : ""}`}><div className="rag-card-top"><label className="rag-select-control"><input type="checkbox" checked={checked} disabled={chosen} onChange={() => togglePending(item.id)} aria-label={`Select ${item.title}`}/><span>{chosen ? "Added" : checked ? "Selected" : "Select"}</span></label><span className={`rag-status ${chosen ? "added" : "available"}`}>{chosen ? "In library" : "Available"}</span></div><strong>{sourceUrl({ ...item, sourceType }) ? <a className="rag-source-link" href={sourceUrl({ ...item, sourceType })} target="_blank" rel="noreferrer">{item.title}<span aria-hidden="true">↗</span></a> : item.title}</strong><small>{activeTab === "products" ? `${item.vendor || "Store product"} · ${item.status.toLowerCase()}` : activeTab === "collections" ? `${item.productsCount?.count || 0} products` : activeTab === "policies" ? String(item.type || "Store policy").replaceAll("_", " ").toLowerCase() : `/${item.handle}`}</small>{!chosen && <button className="rag-card-action" type="button" onClick={() => { setDraftIds((current) => ({ ...current, [activeTab]: [...current[activeTab], item.id] })); setPending((current) => current.filter((id) => id !== item.id)); }}><AdminIcon name="plus"/> Add to library</button>}{chosen && <button className="rag-card-action added" type="button" onClick={() => removeSource({ ...item, sourceType })}><AdminIcon name="trash"/> Remove from library</button>}</article>; })}</div><div className="rag-bulk-action"><span>Showing {Math.min((pageNumber - 1) * pageSize + 1, currentItems.length)}–{Math.min(pageNumber * pageSize, currentItems.length)} of {currentItems.length} · {pending.length} selected</span><div className="rag-pagination"><button className="admin-secondary" type="button" disabled={pageNumber <= 1} onClick={() => { setPageNumber((page) => page - 1); setPending([]); }}>← Previous</button><span>Page {pageNumber} of {pageCount}</span><button className="admin-secondary" type="button" disabled={pageNumber >= pageCount} onClick={() => { setPageNumber((page) => page + 1); setPending([]); }}>Next →</button></div></div></> : activeTab === "policies" && loaderData.policyLoadError ? <div className="rag-policy-warning"><span><AdminIcon name="info"/></span><div><strong>Policies need permission</strong><p>{loaderData.policyLoadError}</p></div></div> : <div className="rag-empty rag-empty-inline"><span className="rag-empty-mark">⌕</span><strong>No {activeLabels[activeTab]} found</strong><p>When you add store content in Shopify, it will appear here.</p></div>}
        </div>
      </section>
    </div>
    {modal === "custom" && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="rag-custom-title"><header className="admin-modal-header"><div><span className="admin-modal-kicker">CUSTOM STORE KNOWLEDGE</span><h2 id="rag-custom-title">Add custom content</h2><p>Write guidance your concierge can use when helping shoppers.</p></div><button className="admin-modal-x" type="button" onClick={() => setModal(null)} aria-label="Close">×</button></header><form onSubmit={addCustom}><label className="admin-field">Content title<input className="admin-text-input" value={customDraft.title} onChange={(event) => setCustomDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Jacket sizing advice" required/></label><label className="admin-field">Content<textarea className="admin-text-input admin-textarea" value={customDraft.content} onChange={(event) => setCustomDraft((current) => ({ ...current, content: event.target.value }))} placeholder="Add helpful details, instructions, or answers…" required/></label><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setModal(null)}><AdminIcon name="close"/> Cancel</button><button className="admin-cta" type="submit"><AdminIcon name="plus"/> Add to library</button></footer></form></section></div>}
    {modal?.type === "read" && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="rag-document-title"><header className="admin-modal-header"><div><span className="admin-modal-kicker">UPLOADED DOCUMENT</span><h2 id="rag-document-title">{modal.document.fileName}</h2><p>Extracted text preview</p></div><button className="admin-modal-x" type="button" onClick={() => setModal(null)} aria-label="Close">×</button></header><pre className="rag-document-preview">{modal.document.content}</pre><footer className="admin-modal-actions"><button className="admin-secondary" type="button" onClick={() => setModal(null)}>Close</button></footer></section></div>}
  </s-page>;
}
export const headers = (args) => boundary.headers(args);
