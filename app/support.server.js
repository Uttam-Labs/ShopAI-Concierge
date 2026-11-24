export const DEFAULT_TICKET_OPTIONS = [
  {
    id: "order-delivery",
    label: "Order or delivery",
    question: "What can we help you with about your order?",
    answer: "If you have an order number, please keep it ready for the support team.",
    active: true,
  },
  {
    id: "product-support",
    label: "Product support",
    question: "What product do you need help with?",
    answer: "Our team will review your product question and follow up by email.",
    active: true,
  },
  {
    id: "returns-refunds",
    label: "Returns or refunds",
    question: "How can we help with your return or refund?",
    answer: "Our team will check the store’s return policy and follow up by email.",
    active: true,
  },
];

export function normalizeTicketOptions(value) {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_TICKET_OPTIONS;
  const seen = new Set();
  return value.slice(0, 20).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const id = String(item.id || `request-${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 48);
    const label = String(item.label || "").trim().slice(0, 80);
    const question = String(item.question || "").trim().slice(0, 280);
    const answer = String(item.answer || "").trim().slice(0, 1200);
    if (!id || !label || !question || !answer || seen.has(id)) return [];
    seen.add(id);
    return [{ id, label, question, answer, active: item.active !== false }];
  });
}

export function normalizeTicketPrefix(value) {
  const prefix = String(value || "SAC").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 10);
  return prefix || "SAC";
}
