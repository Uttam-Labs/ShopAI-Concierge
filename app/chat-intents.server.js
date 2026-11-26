const POLICY_INTENT = /\b(policy|policies|shipping|delivery|return|returns|refund|exchange|send\s+(?:it\s+)?back|send\s+back|doesn['’]?t\s+fit|too\s+(?:big|small)|cancel|cancellation|privacy|terms|warranty|guarantee|payment|dispatch)\b|নীতি|শিপিং|ডেলিভারি|ফেরত|রিটার্ন|রিফান্ড|বাতিল|গোপনীয়তা|পেমেন্ট|ওয়ারেন্টি/i;

const SUPPORT_REQUEST_INTENT = /\b(?:contact\s+(?:(?:the|your)\s+)?(?:store\s+)?support|customer\s+support|support\s+team|talk\s+to\s+(?:a\s+)?(?:human|person|someone|agent)|speak\s+to\s+(?:a\s+)?(?:human|person|someone|agent)|real\s+person|live\s+agent|human\s+help|someone\s+from\s+(?:the\s+)?(?:store|support)\s+team|help\s+from\s+(?:the\s+)?support)\b|সাপোর্টের সাথে কথা|মানুষের সাথে কথা/i;
const SUPPORT_ESCALATION_INTENT = /\b(refund not received|dispute|chargeback|angry|frustrated|unacceptable|complaint|broken|damaged)\b/i;
const ORDER_CANCEL_INTENT = /\b(?:cancel(?:lation)?|stop)\b.{0,55}\b(?:order|purchase|parcel|delivery)\b|\b(?:order|purchase)\b.{0,55}\b(?:cancel(?:lation)?|stop)\b/i;
const ORDER_REFERENCE_INTENT = /\b(?:order|purchase|parcel|package|shipment|delivery|tracking|checkout|confirmation)\b/i;
const RETURN_ACTION_INTENT = /\b(?:i want to return|i need to return|i['’]d like to return|i would like to return|please return|submit a return|request (?:a )?return|start a return|i want (?:a refund|an exchange|to exchange|to swap|to send (?:it|this) back)|i need (?:a refund|an exchange|to exchange|to swap|to send (?:it|this) back)|i['’]d like (?:a refund|an exchange|to exchange|to swap|to send (?:it|this) back)|please refund|request (?:a )?refund)\b/i;
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

export function isReturnRequestIntent(message) {
  return RETURN_ACTION_INTENT.test(String(message || ""));
}

export function resolveOrderQuestionIntent(message = "") {
  const text = String(message || "").toLocaleLowerCase();
  const hasOrderContext = ORDER_REFERENCE_INTENT.test(text) || /\bafter\s+(?:i\s+)?ordering\b|\b(?:wrong|incorrect)\s+(?:delivery\s+)?(?:address|phone|email)\b/i.test(text);
  if (!hasOrderContext) return null;
  if (ORDER_CANCEL_INTENT.test(text)) return "cancellation";
  if (/\b(?:paid|payment went through|payment was taken|charged)\b.{0,55}\b(?:confirmation|email|order)\b|\b(?:confirmation|order)\b.{0,55}\b(?:paid|payment|charged)\b/i.test(text)) return "payment_confirmation";
  if (/\b(?:invoice|receipt|tax invoice)\b/i.test(text)) return "invoice";
  if (/\b(?:confirmation|confirm|receipt)\s+email\b.{0,45}\b(?:missing|lost|didn\W?t|haven\W?t|not received|resend|send again)\b|\b(?:missing|lost|didn\W?t|haven\W?t|not received)\b.{0,45}\b(?:confirmation|confirm|receipt)\s+email\b/i.test(text)) return "confirmation_email";
  if (/\b(?:where|find|locate)\b.{0,35}\b(?:order\s*(?:number|no\.?|id)|order number)\b|\b(?:order\s*(?:number|no\.?|id))\b.{0,35}\b(?:where|find|locate)\b/i.test(text)) return "find_order_number";
  if (/\b(?:without|don\W?t have|do not have|lost|forgot|can\W?t find|cannot find|no)\b.{0,30}\b(?:order\s*(?:number|no\.?|id)|order id)\b.{0,45}\b(?:track|tracking|check|status|find)\b|\b(?:track|tracking|check|status)\b.{0,45}\b(?:without|no)\b.{0,20}\border\s*(?:number|no\.?|id)\b/i.test(text)) return "track_without_number";
  if (/\b(?:change|update|correct|edit|fix|add)\b.{0,55}\b(?:delivery\s+)?(?:address|phone|telephone|mobile|email|contact|size|colour|color|quantity|item|product)\b|\b(?:wrong|incorrect)\b.{0,25}\b(?:address|phone|telephone|mobile|email|contact)\b|\b(?:address|phone|telephone|mobile|email|contact|size|colour|color|quantity)\b.{0,55}\b(?:change|update|correct|edit|fix)\b|\b(?:add|include)\b.{0,35}\b(?:item|product)\b.{0,35}\b(?:order|purchase)\b/i.test(text)) return "order_change";
  if (/\b(?:damaged|broken|wrong item|wrong product|wrong size|wrong colour|wrong color|missing item|missing product|only got part|partial order|part of my order|split (?:the )?order|delivered but (?:i|we) (?:do not|don\W?t|haven\W?t|never) (?:have|receive|get|got)|never arrived|not delivered|didn\W?t arrive|hasn\W?t arrived|not arrived|order incomplete|only (?:one|part|some)\b.{0,35}\b(?:arrived|came|received)|courier (?:could not|couldn\W?t) deliver|failed delivery|delivery attempt failed|\b(?:late|delayed)\b.{0,35}\b(?:order|parcel|package|shipment|delivery)\b|\b(?:order|parcel|package|shipment|delivery)\b.{0,35}\b(?:late|delayed)\b)\b/i.test(text)) return /\b(?:damaged|broken|wrong item|wrong product|wrong size|wrong colour|wrong color|missing item|missing product)\b/i.test(text) ? "order_item_issue" : "order_delivery_issue";
  if (/\b(?:tracking|track)\b.{0,45}\b(?:not updated|hasn\W?t updated|stuck|not moving|no update|hasn\W?t moved)\b|\b(?:not updated|stuck|no update)\b.{0,45}\b(?:tracking|track)\b/i.test(text)) return "tracking_delay";
  if (/\b(?:where is|where's|track|tracking|status of|order status|has my order shipped|is my order shipped|when will my order arrive|any update on my order)\b/i.test(text)) return "order_status";
  if (!isPolicyIntent(text) && /\b(?:my|our|the|this|an?)\s+(?:recent\s+)?(?:order|purchase)\b/i.test(text)) return "general_order";
  return null;
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
