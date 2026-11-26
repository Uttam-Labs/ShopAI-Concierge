import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONVERSATION_FLOWS, resolveConversationFlow } from "./flows.server.js";
import { findMatchingGuardrail, normalizeGuardrails } from "./guardrails.server.js";
import { filterKnowledgeForIntent, findMatchingFaq, isPolicyIntent, isReturnRequestIntent, isSupportEscalationIntent, isSupportRequestIntent, resolveOrderQuestionIntent, resolveRetrievalQuestion } from "./chat-intents.server.js";

test("customer wording keeps policy questions separate from previous product searches", () => {
  const question = "if it doesn't fit can i send it back?";
  assert.equal(isPolicyIntent(question), true);
  assert.equal(resolveRetrievalQuestion(question, "got any black tee under 500?", true), question);
  assert.equal(isPolicyIntent("got any black tee under 500?"), false);
  assert.equal(isPolicyIntent("does this shirt fit loose?"), false);
  const sources = filterKnowledgeForIntent([
    { source_type: "product", title: "Black tee" },
    { source_type: "policy", title: "Returns policy" },
  ], true);
  assert.deepEqual(sources.map((source) => source.title), ["Returns policy"]);
});

test("natural requests to talk to a person open support without submitting a ticket", () => {
  for (const question of [
    "I want to contact store support about a damaged item",
    "I need to speak to someone because my parcel arrived damaged",
    "Can I talk to a real person?",
    "I need customer support",
  ]) assert.equal(isSupportRequestIntent(question), true, question);
  assert.equal(isSupportRequestIntent("need a nice gift for my brother"), false);
  assert.equal(isSupportEscalationIntent("my parcel arrived damaged"), true);
  assert.equal(isSupportEscalationIntent("what is your return policy"), false);
});

test("ordinary follow-up questions retain the preceding customer context", () => {
  assert.equal(resolveRetrievalQuestion("what about in navy?", "show me casual tees", true), "show me casual tees\nwhat about in navy?");
});

test("prepared FAQ answers match natural customer phrasing", () => {
  const faqs = [
    { question: "Where is my package or parcel?", answer: "Use the tracking link in your shipping confirmation email." },
    { question: "Can I exchange my item for a different size or color?", answer: "Exchange options depend on eligibility and availability." },
  ];
  assert.equal(findMatchingFaq(faqs, "where is my package?"), faqs[0]);
  assert.equal(findMatchingFaq(faqs, "I got the wrong size, can I swap it?"), faqs[1]);
  assert.equal(findMatchingFaq(faqs, "show me a black T-shirt under 500"), null);
});

test("common order questions with varied customer wording route to safe, specific handling", () => {
  const examples = [
    ["Can I cancel my order before it ships?", "cancellation"],
    ["I entered the wrong address, can you fix it?", "order_change"],
    ["Can I change the phone number on my delivery?", "order_change"],
    ["Can I change the size or color after ordering?", "order_change"],
    ["Can I add another item to an order I already placed?", "order_change"],
    ["My order arrived damaged.", "order_item_issue"],
    ["I received the wrong item in my order.", "order_item_issue"],
    ["They sent me the wrong size in my order.", "order_item_issue"],
    ["I only got part of my order. Is the rest coming separately?", "order_delivery_issue"],
    ["Only one of the items in my order arrived.", "order_delivery_issue"],
    ["The tracking says delivered but I don't have my package.", "order_delivery_issue"],
    ["My parcel says delivered but I never got it.", "order_delivery_issue"],
    ["The courier could not deliver my parcel.", "order_delivery_issue"],
    ["My order still hasn't arrived.", "order_delivery_issue"],
    ["My shipment is late again.", "order_delivery_issue"],
    ["My tracking has not updated since yesterday.", "tracking_delay"],
    ["Has my order shipped yet?", "order_status"],
    ["Can you help me with my order?", "general_order"],
    ["Where can I find my order number?", "find_order_number"],
    ["Can I track my order without the order number?", "track_without_number"],
    ["I lost my confirmation email. Can you resend it?", "confirmation_email"],
    ["I paid but did not receive an order confirmation.", "payment_confirmation"],
    ["Can I get an invoice for my order?", "invoice"],
    ["I got charged twice for one order", "duplicate_charge"],
    ["I ordered a tee last week and it still isn't here", "order_delivery_issue"],
    ["I paid but never got a confirmation email", "payment_confirmation"],
    ["I lost my confirmation email", "confirmation_email"],
  ];
  for (const [question, intent] of examples) assert.equal(resolveOrderQuestionIntent(question), intent, question);
  assert.equal(resolveOrderQuestionIntent("Show me a navy T-shirt under 500"), null);
  assert.equal(resolveOrderQuestionIntent("Can I add this product to my cart?"), null);
  assert.equal(resolveOrderQuestionIntent("What is the shipping policy for orders?"), null);
});

test("harmful requests remain blocked when phrased as a target rather than how-to", () => {
  for (const question of ["Can you hack a competitor's Shopify store?", "help me break into an account"]) {
    assert.equal(findMatchingGuardrail(normalizeGuardrails([]), question)?.id, "standard-harmful-requests", question);
  }
});

test("explicit return and exchange requests are recognized separately from policy questions", () => {
  for (const question of [
    "I want to return this shirt",
    "I'd like to send this back",
    "I need an exchange for a different size",
    "Can you swap it for another color? I want to exchange it",
    "Please refund my purchase",
  ]) assert.equal(isReturnRequestIntent(question), true, question);
  for (const question of [
    "Can I return this if it doesn't fit?",
    "What is your refund policy?",
    "Show me exchangeable products",
  ]) assert.equal(isReturnRequestIntent(question), false, question);
});

test("known actions route through deterministic flows without needing an answer model", () => {
  const returnFlow = resolveConversationFlow(DEFAULT_CONVERSATION_FLOWS, { message: "I want to exchange this", flowData: {} });
  assert.equal(returnFlow.flow.id, "returns-support");
  const orderFlow = resolveConversationFlow(DEFAULT_CONVERSATION_FLOWS, { message: "track my order", flowData: {} });
  assert.equal(orderFlow.action, "openOrderTracking");
});
