import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
});

async function saveConversation(shop, sessionId, userMessage, assistantMessage) {
  if (!shop || !sessionId || sessionId.length > 120 || !userMessage) return;
  const prior = await prisma.conversation.findUnique({ where: { shop_session: { shop, session: sessionId } } });
  const messages = [...(Array.isArray(prior?.messages) ? prior.messages : []), { role: "user", content: userMessage }, { role: "assistant", content: assistantMessage }].slice(-40);
  await prisma.conversation.upsert({ where: { shop_session: { shop, session: sessionId } }, create: { shop, session: sessionId, messages }, update: { messages } });
}

export const loader = async ({ request }) => {
  await authenticate.public.appProxy(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
  const shop = new URL(request.url).searchParams.get("shop")?.toLowerCase();
  if (shop && /^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(shop)) {
    const allowed = (process.env.STOREFRONT_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
    const origin = request.headers.get("origin");
    if (allowed.length && origin && !allowed.includes(origin)) return Response.json({ error: "This storefront is not allowed." }, { status: 403, headers: cors(origin) });
    const settings = await prisma.assistantSettings.findUnique({ where: { shop }, select: { defaultGreeting: true, faqs: true } });
    const faqs = settings?.faqs === false ? [] : await prisma.faq.findMany({ where: { shop, active: true }, select: { question: true }, orderBy: { createdAt: "desc" }, take: 6 });
    return Response.json({ greeting: settings?.defaultGreeting || "Hi there! 👋 Tell me what you’re shopping for, ask about our policies, or track an order.", faqs }, { headers: cors(origin) });
  }
  return Response.json({ error: "Use POST to send a chat message." }, { status: 405, headers: cors(request.headers.get("origin")) });
};

export const action = async ({ request }) => {
  await authenticate.public.appProxy(request);
  const origin = request.headers.get("origin");
  const allowed = (process.env.STOREFRONT_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (allowed.length && origin && !allowed.includes(origin)) return Response.json({ error: "This storefront is not allowed." }, { status: 403, headers: cors(origin) });
  const headers = cors(origin);
  let normalizedShop;
  let sessionId;
  let userMessage;
  try {
    const { message, shop: bodyShop, sessionId: requestSessionId, customerEmail } = await request.json();
    const shop = new URL(request.url).searchParams.get("shop") || bodyShop;
    if (typeof message !== "string" || !message.trim() || message.length > 1000) return Response.json({ error: "Please enter a message up to 1,000 characters." }, { status: 400, headers });
    if (typeof shop !== "string" || !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(shop) || (bodyShop && bodyShop.toLowerCase() !== shop.toLowerCase())) return Response.json({ error: "Invalid shop information." }, { status: 400, headers });
    normalizedShop = shop.toLowerCase();
    sessionId = typeof requestSessionId === "string" ? requestSessionId : "";
    userMessage = message.trim();
    const settings = { recommendations: true, orderLookup: true, humanHandoff: true, faqs: true, responseGuidelines: "" , ...(await prisma.assistantSettings.findUnique({ where: { shop: normalizedShop } }) || {}) };
    const activeFaqs = settings.faqs ? await prisma.faq.findMany({ where: { shop: normalizedShop, active: true }, select: { question: true, answer: true }, take: 100 }) : [];
    const orderMatch = userMessage.match(/#?(\d{3,})/);
    const email = String(customerEmail || userMessage.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "").trim().toLowerCase();
    if (settings.orderLookup && orderMatch && email && sessionId && process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET) {
      const crypto = await import("node:crypto");
      const recent = await prisma.orderLookupAttempt.findFirst({ where: { shop: normalizedShop, orderHint: orderMatch[1], createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } } });
      if (recent) {
        const answer = "A lookup for this order was just made. Please wait a few minutes before trying again.";
        await saveConversation(normalizedShop, sessionId, userMessage, answer);
        return Response.json({ answer }, { headers });
      }
      await prisma.orderLookupAttempt.create({ data: { shop: normalizedShop, orderHint: orderMatch[1], result: { ok: false } } });
      try {
        const tokenResponse = await fetch(`https://${normalizedShop}/admin/oauth/access_token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: process.env.SHOPIFY_API_KEY, client_secret: process.env.SHOPIFY_API_SECRET, grant_type: "client_credentials" }) });
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          const query = `query OrderLookup($query: String!) { orders(first: 1, query: $query) { nodes { name email displayFulfillmentStatus fulfillments(first: 5) { trackingInfo { number url company } } } } }`;
          const orderResponse = await fetch(`https://${normalizedShop}/admin/api/2026-07/graphql.json`, { method: "POST", headers: { "content-type": "application/json", "X-Shopify-Access-Token": tokenData.access_token }, body: JSON.stringify({ query, variables: { query: `name:#${orderMatch[1]} email:${email}` } }) });
          const orderData = await orderResponse.json();
          const order = orderData.data?.orders?.nodes?.[0];
          if (order && order.email?.toLowerCase() === email) {
            const tracking = order.fulfillments.flatMap((f) => f.trackingInfo || []).map((t) => `${t.company || "Carrier"}: ${t.number}${t.url ? ` (${t.url})` : ""}`).join("\n");
            await prisma.orderLookupAttempt.updateMany({ where: { shop: normalizedShop, orderHint: orderMatch[1], result: { path: ["ok"], equals: false } }, data: { result: { ok: true, status: order.displayFulfillmentStatus } } });
            const answer = `Order ${order.name}: ${String(order.displayFulfillmentStatus || "Status unavailable").replaceAll("_", " ")}.${tracking ? `\nTracking: ${tracking}` : " No tracking information is available yet."}`;
            await saveConversation(normalizedShop, sessionId, userMessage, answer);
            return Response.json({ answer }, { headers });
          }
        }
      } catch (error) { console.error("Order lookup failed", error); }
      const answer = "I couldn’t verify an order with those details. Check the order number and checkout email, or contact the store team.";
      await saveConversation(normalizedShop, sessionId, userMessage, answer);
      return Response.json({ answer }, { headers });
    }
    if (settings.orderLookup && orderMatch && !email) {
      const answer = "Please include the email address used at checkout with your order number so I can verify the order.";
      await saveConversation(normalizedShop, sessionId, userMessage, answer);
      return Response.json({ answer }, { headers });
    }
    if (settings.humanHandoff && /refund not received|dispute|chargeback|angry|frustrated|unacceptable|complaint|speak to (a )?(human|person|agent)|talk to (a )?(human|person|agent)|broken|damaged/i.test(userMessage)) {
      const reference = `SAC-${Date.now().toString(36).toUpperCase()}`;
      await prisma.ticket.create({ data: { reference, shop: normalizedShop, customer: "Storefront visitor", email: email || null, subject: userMessage.slice(0, 100), message: userMessage, status: "open" } });
      const answer = `I’ve sent this to the store support team. Your ticket number is ${reference}.`;
      await saveConversation(normalizedShop, sessionId, userMessage, answer);
      return Response.json({ answer, ticket: { reference } }, { headers });
    }
    if (activeFaqs.length) {
      const normalize = (value) => String(value || "").toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
      const customerQuestion = normalize(message);
      const customerWords = new Set(customerQuestion.split(" ").filter((word) => word.length > 2));
      const matchingFaq = activeFaqs.map((faq) => {
        const faqQuestion = normalize(faq.question);
        const faqWords = faqQuestion.split(" ").filter((word) => word.length > 2);
        const overlap = faqWords.filter((word) => customerWords.has(word)).length;
        return { faq, score: faqQuestion === customerQuestion ? 1 : overlap / Math.max(1, faqWords.length) };
      }).sort((left, right) => right.score - left.score)[0];
      if (matchingFaq && matchingFaq.score >= 0.7) {
        await saveConversation(normalizedShop, sessionId, userMessage, matchingFaq.faq.answer);
        return Response.json({ answer: matchingFaq.faq.answer, products: [] }, { headers });
      }
    }
    if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const answer = "I can answer the store’s published FAQs. Product advice is not enabled yet; please contact the store team for help with this question.";
      await saveConversation(normalizedShop, sessionId, userMessage, answer);
      return Response.json({ answer, products: [] }, { headers });
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embedded = await openai.embeddings.create({ model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small", input: message.trim() });
    const { data: context, error } = await supabase.rpc("match_knowledge", { query_embedding: embedded.data[0].embedding, match_count: 8, filter_shop: normalizedShop });
    if (error) throw error;
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: `You are a concise, helpful store sales and support assistant. Use only the supplied store knowledge. Do not invent products, stock, policies, tracking or discounts. If information is missing, say so and offer human support. Never promise a discount. ${settings.humanHandoff ? "For unresolved or sensitive issues, offer to connect the shopper with the store team." : "Do not promise a human handoff; suggest the store's published contact options instead."} Merchant response guidance: ${settings.responseGuidelines || "Be concise, helpful, and on-brand."}` },
        { role: "user", content: `Store knowledge:\n${(context || []).map((row) => row.content).join("\n\n")}\n\nApproved active FAQs:\n${activeFaqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n\n")}\n\nCustomer question: ${userMessage}` },
      ],
    });
    const products = settings.recommendations ? (context || []).filter((row) => row.source_type === "product").slice(0, 4).map((row) => ({ title: row.title, image: row.metadata?.image, price: row.metadata?.variants?.[0]?.price, variants: row.metadata?.variants || [] })) : [];
    const answer = completion.choices[0]?.message?.content || "I could not find a reliable answer in the store information.";
    await saveConversation(normalizedShop, sessionId, userMessage, answer);
    return Response.json({ answer, products }, { headers });
  } catch (error) {
    console.error("Chat request failed", error);
    if (normalizedShop && userMessage) await saveConversation(normalizedShop, sessionId, userMessage, "Sorry, the assistant could not answer right now. Please try again shortly.").catch((saveError) => console.error("Conversation save failed", saveError));
    return Response.json({ error: "Sorry, the assistant could not answer right now. Please try again shortly." }, { status: 500, headers });
  }
};
