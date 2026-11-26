const POLICY_INTENT = /\b(policy|policies|shipping|delivery|return|returns|refund|exchange|send\s+(?:it\s+)?back|send\s+back|doesn['’]?t\s+fit|too\s+(?:big|small)|cancel|cancellation|privacy|terms|warranty|guarantee|payment|dispatch)\b|নীতি|শিপিং|ডেলিভারি|ফেরত|রিটার্ন|রিফান্ড|বাতিল|গোপনীয়তা|পেমেন্ট|ওয়ারেন্টি/i;

const SUPPORT_REQUEST_INTENT = /\b(?:contact\s+(?:(?:the|your)\s+)?(?:store\s+)?support|customer\s+support|support\s+team|talk\s+to\s+(?:a\s+)?(?:human|person|someone|agent)|speak\s+to\s+(?:a\s+)?(?:human|person|someone|agent)|real\s+person|live\s+agent|human\s+help|someone\s+from\s+(?:the\s+)?(?:store|support)\s+team|help\s+from\s+(?:the\s+)?support)\b|সাপোর্টের সাথে কথা|মানুষের সাথে কথা/i;
const SUPPORT_ESCALATION_INTENT = /\b(refund not received|dispute|chargeback|angry|frustrated|unacceptable|complaint|broken|damaged)\b/i;
const FAQ_STOP_WORDS = new Set(["a", "an", "and", "are", "can", "could", "do", "does", "for", "how", "i", "is", "it", "me", "my", "of", "on", "or", "the", "to", "we", "what", "when", "where", "which", "will", "with", "you", "your", "please", "help", "order", "product", "store"]);
const FAQ_ALIASES = { package: "shipping", parcel: "shipping", delivery: "shipping", shipped: "shipping", delivered: "shipping", shipment: "shipping", courier: "shipping", exchange: "return", refund: "return", swap: "return", swapping: "return", replace: "return", money: "payment", paid: "payment", charge: "payment", cancel: "cancellation", cancelled: "cancellation", canceled: "cancellation", change: "edit", update: "edit", modify: "edit", address: "edit", email: "contact", phone: "contact", speak: "human", agent: "human", person: "human", representative: "human", discount: "promotion", coupon: "promotion", promo: "promotion", code: "promotion", size: "fit", sizing: "fit", available: "stock", availability: "stock", sold: "stock", restock: "stock" };

export function isPolicyIntent(message) {
  return POLICY_INTENT.test(String(message || ""));
}

export function isSupportRequestIntent(message) {
  return SUPPORT_REQUEST_INTENT.test(String(message || ""));
}

export function isSupportEscalationIntent(message) {
  return SUPPORT_ESCALATION_INTENT.test(String(message || ""));
}

export function findMatchingFaq(faqs = [], message = "") {
  const normalize = (value) => String(value || "").toLocaleLowerCase().normalize("NFKD").replace(/^\s*\d+[.)\s-]+/, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const terms = (value) => [...new Set(normalize(value).split(" ").filter((word) => word.length > 2 && !FAQ_STOP_WORDS.has(word)).map((word) => FAQ_ALIASES[word] || word))];
  const customerQuestion = normalize(message);
  const customerWords = new Set(terms(customerQuestion));
  const matchingFaq = faqs.map((faq) => {
    const faqQuestion = normalize(faq.question);
    const faqWords = terms(faqQuestion);
    const overlap = faqWords.filter((word) => customerWords.has(word)).length;
    const precision = overlap / Math.max(1, customerWords.size);
    const score = overlap / Math.max(1, Math.min(faqWords.length, customerWords.size));
    const coverage = overlap / Math.max(1, faqWords.length);
    return { faq, score: faqQuestion === customerQuestion ? 1 : score, precision, coverage, overlap };
  }).sort((left, right) => right.score - left.score)[0];
  return matchingFaq && (matchingFaq.score === 1 || (matchingFaq.overlap >= 2 && matchingFaq.precision >= 0.5 && matchingFaq.coverage >= 0.35) || (customerWords.size <= 3 && matchingFaq.overlap >= 1 && matchingFaq.precision >= 0.5 && matchingFaq.coverage >= 0.3))
    ? matchingFaq.faq
    : null;
}

export function resolveRetrievalQuestion(message, previousUserMessage = "", isConversationalFollowup = false) {
  const latest = String(message || "").trim();
  if (isPolicyIntent(latest)) return latest;
  return isConversationalFollowup && previousUserMessage
    ? `${previousUserMessage}\n${latest}`.slice(0, 1000)
    : latest;
}

export function filterKnowledgeForIntent(rows = [], policyIntent = false) {
  return policyIntent
    ? rows.filter((row) => ["policy", "page", "faq", "custom"].includes(row.source_type))
    : rows;
}
