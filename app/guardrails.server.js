export const DEFAULT_GUARDRAILS = [
  {
    id: "standard-customer-privacy",
    title: "Protect customer privacy",
    phrases: ["another customer", "someone else's order", "someone elses order", "other customer's order", "other customers order", "someone else's email", "someone else's address", "someone else's personal information"],
    response: "For privacy, I can only help with your own order and account. I can’t share another customer’s information. If you’re checking your order, use its order number and checkout email.",
    enabled: true,
    standard: true,
  },
  {
    id: "standard-harmful-requests",
    title: "Decline harmful or illegal requests",
    phrases: ["how to hack", "hack a competitor", "hack an account", "hack someone's account", "break into an account", "steal", "make a weapon", "build a bomb", "bypass security", "commit fraud"],
    response: "I can help with products, orders, and store support, but I can’t assist with harmful or illegal activities.",
    enabled: true,
    standard: true,
  },
  {
    id: "standard-respectful-chat",
    title: "Keep the conversation respectful",
    phrases: ["fuck", "fucking", "shit", "bitch", "asshole", "idiot"],
    response: "I’m here to help with store-related questions. Please keep the conversation respectful so I can assist you.",
    enabled: true,
    standard: true,
  },
];

export function normalizeGuardrails(value) {
  const submitted = Array.isArray(value) ? value : [];
  const cleaned = submitted.slice(0, 50).map((item, index) => ({
    id: String(item?.id || `guardrail-${index + 1}`).slice(0, 100),
    title: String(item?.title || "Untitled guardrail").trim().slice(0, 120),
    phrases: (Array.isArray(item?.phrases) ? item.phrases : []).map((phrase) => String(phrase).trim().slice(0, 120)).filter(Boolean).slice(0, 40),
    response: String(item?.response || "").trim().slice(0, 2000),
    enabled: item?.enabled !== false,
    standard: item?.standard === true,
  })).filter((item) => item.title && item.phrases.length && item.response);
  const standards = DEFAULT_GUARDRAILS.map((defaultRule) => {
    const saved = cleaned.find((rule) => rule.id === defaultRule.id);
    return { ...defaultRule, ...(saved || {}), id: defaultRule.id, standard: true, enabled: true };
  });
  return [...standards, ...cleaned.filter((rule) => !DEFAULT_GUARDRAILS.some((defaultRule) => defaultRule.id === rule.id) && !rule.standard)];
}

const normalizeText = (value) => String(value || "")
  .toLocaleLowerCase()
  .normalize("NFKD")
  .replace(/[’‘]/g, "'")
  .replace(/[^\p{L}\p{N}'\s]/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

export function findMatchingGuardrail(guardrails, message) {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) return null;
  return normalizeGuardrails(guardrails).find((rule) => rule.enabled && rule.phrases.some((phrase) => {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedPhrase) return false;
    if (normalizedPhrase.includes(" ")) return normalizedMessage.includes(normalizedPhrase);
    const escapedPhrase = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapedPhrase}(?:$|[^\\p{L}\\p{N}])`, "u").test(normalizedMessage);
  })) || null;
}
