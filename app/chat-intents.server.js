const POLICY_INTENT = /\b(policy|policies|shipping|delivery|returns?|refunds?|exchanges?|send\s+(?:it\s+)?back|send\s+back|doesn['’]?t\s+fit|too\s+(?:big|small)|cancel|cancellation|privacy|terms|warranty|guarantee|payment|dispatch)\b|নীতি|শিপিং|ডেলিভারি|ফেরত|রিটার্ন|রিফান্ড|বাতিল|গোপনীয়তা|পেমেন্ট|ওয়ারেন্টি/i;

const SUPPORT_REQUEST_INTENT = /\b(?:contact\s+(?:(?:the|your)\s+)?(?:store\s+)?support|customer\s+support|support\s+team|talk\s+to\s+(?:a\s+)?(?:human|person|someone|agent)|speak\s+(?:to|with)\s+(?:a\s+)?(?:human|person|someone|agent)|connect\s+me\s+(?:to|with)\s+(?:a\s+)?(?:human|person|someone|agent)|real\s+person|live\s+agent|human\s+help|someone\s+from\s+(?:the\s+)?(?:store|support)\s+team|help\s+from\s+(?:the\s+)?support|can\s+someone\s+from\s+(?:the\s+)?store\s+help)\b|সাপোর্টের সাথে কথা|মানুষের সাথে কথা/i;
const SUPPORT_ESCALATION_INTENT = /\b(refund not received|dispute|chargeback|angry|frustrated|unacceptable|complaint|complain|broken|damaged)\b/i;
const ORDER_CANCEL_INTENT = /\b(?:cancel(?:lation)?|stop)\b.{0,55}\b(?:order|purchase|parcel|delivery)\b|\b(?:order|purchase)\b.{0,55}\b(?:cancel(?:lation)?|stop)\b/i;
const ORDER_REFERENCE_INTENT = /\b(?:order|ordered|purchase|parcel|package|shipment|delivery|tracking|track|courier|carrier|checkout|confirmation)\b/i;
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
  const text = String(message || "");
  if (/\b(?:if|whether|in case)\b.{0,35}\b(?:fit|fits|too big|too small|change my mind)\b/i.test(text)) return RETURN_ACTION_INTENT.test(text);
  return RETURN_ACTION_INTENT.test(text)
    || /\b(?:can|could|would)\s+i\s+(?:return|exchange|swap)\s+(?:this|that|my|the|an?|these|those)\b/i.test(text)
    || /\b(?:can|could)\s+i\s+send\s+(?:this|that|my|the|an?|these|those)\b.{0,30}\bback\b/i.test(text)
    || /\b(?:help me|need to|want to|would like to)\s+(?:return|exchange|swap|send\s+(?:this|that|it|the item|the product)\s+back)\b/i.test(text);
}

export function resolveOrderQuestionIntent(message = "") {
  const rawText = String(message || "").toLocaleLowerCase();
  const text = rawText
    .replace(/\bordr\b/g, "order").replace(/\bdelivred\b/g, "delivered")
    .replace(/\btrackng\b/g, "tracking").replace(/\btrkng\b/g, "tracking")
    .replace(/\bhasnt\b/g, "has not").replace(/\bhavent\b/g, "have not")
    .replace(/\bdidnt\b/g, "did not").replace(/\bdoesnt\b/g, "does not")
    .replace(/\bhoise\b/g, "shipped");
  if (/অর্ডার.*(?:কোথায়|কোথায়|স্ট্যাটাস|ট্র্যাক)|(?:কোথায়|কোথায়|স্ট্যাটাস|ট্র্যাক).*অর্ডার/.test(rawText)) return "order_status";
  if (/ট্র্যাকিং.*(?:আপডেট|নড়ছে|নড়ছে).*(?:না|নেই)|ট্র্যাকিং আপডেট হচ্ছে না/.test(rawText)) return "tracking_delay";
  if (/পার্সেল.*(?:আসেনি|পাইনি|পৌঁছায়নি|পৌঁছায়নি)|ডেলিভারি.*(?:হয়েছে|হয়েছে).*(?:পাইনি|পাইনি)|অর্ডার.*(?:আসেনি|পাইনি)/.test(rawText)) return "order_delivery_issue";
  if (/অর্ডার.*(?:শিপ|পাঠানো|হয়েছে|হয়েছে)|শিপ.*অর্ডার/.test(rawText)) return "order_status";
  const hasOrderContext = ORDER_REFERENCE_INTENT.test(text) || /\bafter\s+(?:i\s+)?ordering\b|\b(?:wrong|incorrect)\s+(?:delivery\s+)?(?:address|phone|email)\b|\b(?:paid|payment went through|charged)\b.{0,55}\b(?:confirmation|email|order)\b|\b(?:confirmation|order)\b.{0,55}\b(?:paid|payment|charged)\b|\bcharged\s+(?:me\s+)?(?:twice|two times|again)\b|\b(?:double|duplicate|second)\s+(?:charge|payment)\b|\bordered\b.{0,70}\b(?:late|delayed|not here|not arrived|hasn\W?t arrived|still waiting|still isn\W?t here|still is not here)\b|\b(?:supposed|expected)\s+to\s+(?:arrive|be delivered)\b|\b(?:wrong|missing|damaged|broken|faulty)\s+(?:item|product|size|colour|color)\b|\b(?:my|the|this) item\b.{0,25}\b(?:faulty|damaged|broken)\b|\bonly\s+(?:one|part|some)\s+(?:of\s+)?(?:the\s+)?(?:items?|products?)\b.{0,35}\b(?:arrived|came|received)\b/i.test(text);
  if (!hasOrderContext) return null;
  if (ORDER_CANCEL_INTENT.test(text)) return "cancellation";
  if (/\bcourier\s+(?:tried|attempted)\s+(?:a\s+)?delivery\b|\bdelivery\s+(?:was\s+)?attempted\s+(?:at|to)\s+(?:the\s+)?wrong\s+address\b/i.test(text)) return "order_delivery_issue";
  if (/\bcharged\s+(?:me\s+)?(?:twice|two times|again)\b|\b(?:double|duplicate|second)\s+(?:charge|payment)\b/i.test(text)) return "duplicate_charge";
  if (/\b(?:paid|payment went through|payment was taken|charged)\b.{0,55}\b(?:confirmation|email|order)\b|\b(?:confirmation|order)\b.{0,55}\b(?:paid|payment|charged)\b/i.test(text)) return "payment_confirmation";
  if (/\b(?:invoice|receipt|tax invoice)\b/i.test(text)) return "invoice";
  if (/\b(?:confirmation|confirm|receipt)\s+email\b.{0,45}\b(?:missing|lost|didn\W?t|haven\W?t|not received|resend|send again)\b|\b(?:missing|lost|didn\W?t|haven\W?t|not received)\b.{0,45}\b(?:confirmation|confirm|receipt)\s+email\b|\b(?:lost|missing|didn\W?t|haven\W?t|not received|resend|send again)\b.{0,45}\b(?:confirmation|confirm|receipt)\b/i.test(text)) return "confirmation_email";
  if (/\b(?:where|find|locate)\b.{0,35}\b(?:order\s*(?:number|no\.?|id)|order number)\b|\b(?:order\s*(?:number|no\.?|id))\b.{0,35}\b(?:where|find|locate)\b/i.test(text)) return "find_order_number";
  if (/\b(?:without|don\W?t have|do not have|lost|forgot|can\W?t find|cannot find|no)\b.{0,30}\b(?:order\s*(?:number|no\.?|id)|order id)\b.{0,45}\b(?:track|tracking|check|status|find)\b|\b(?:track|tracking|check|status)\b.{0,45}\b(?:without|no)\b.{0,20}\border\s*(?:number|no\.?|id)\b/i.test(text)) return "track_without_number";
  if (/\b(?:change|update|correct|edit|fix|add)\b.{0,55}\b(?:delivery\s+)?(?:address|phone|telephone|mobile|email|contact|size|colour|color|quantity|item|product)\b|\b(?:wrong|incorrect)\b.{0,25}\b(?:address|phone|telephone|mobile|email|contact)\b|\b(?:address|phone|telephone|mobile|email|contact|size|colour|color|quantity)\b.{0,55}\b(?:change|update|correct|edit|fix)\b|\b(?:add|include)\b.{0,35}\b(?:item|product)\b.{0,35}\b(?:order|purchase)\b/i.test(text)) return "order_change";
  if (/\b(?:damaged|broken|faulty|wrong item|wrong product|wrong size|wrong colour|wrong color|missing item|missing product|item is missing|product is missing|missing from my order|only got part|partial order|part of my order|split (?:the )?order|delivered but (?:i|we) (?:do not|did not|don\W?t|haven\W?t|never) (?:have|receive|get|got)|never arrived|not delivered|didn\W?t arrive|hasn\W?t arrived|not arrived|order incomplete|only (?:one|part|some)\b.{0,35}\b(?:arrived|came|received)|courier (?:could not|couldn\W?t|failed to) deliver|courier (?:tried|attempted) (?:a )?delivery|failed delivery|delivery attempt failed|returned to sender|(?:was )?(?:supposed|expected) to (?:arrive|be delivered)\b.{0,35}\b(?:yesterday|last|ago|already|today)|\b(?:my|the|this) item\b.{0,25}\b(?:faulty|damaged|broken)\b|\b(?:late|delayed|stuck in transit|no movement|out for delivery|delivery date|arrive by|arrive before)\b.{0,45}\b(?:order|parcel|package|shipment|delivery|friday|monday|tuesday|wednesday|thursday|saturday|sunday|tomorrow|today)\b|\b(?:order|parcel|package|shipment|delivery)\b.{0,45}\b(?:late|delayed|stuck in transit|no movement|out for delivery|delivery date)\b|\bordered\b.{0,70}\b(?:late|delayed|not here|not arrived|hasn\W?t arrived|still waiting|still isn\W?t here|still is not here)\b)\b/i.test(text)) return /\b(?:damaged|broken|faulty|wrong item|wrong product|wrong size|wrong colour|wrong color|missing item|missing product|item is missing|product is missing|missing from my order)\b/i.test(text) ? "order_item_issue" : "order_delivery_issue";
  if (/\b(?:tracking|track)\b.{0,45}\b(?:not updated|hasn\W?t updated|stuck|not moving|no update|hasn\W?t moved|not moved|no movement)\b|\b(?:not updated|stuck|no update|not moving|hasn\W?t moved|no movement)\b.{0,45}\b(?:tracking|track)\b|\bno tracking (?:update|movement)\b|\bcourier\b.{0,35}\b(?:scan|tracking)\b.{0,25}\b(?:not updating|no update|stuck)\b/i.test(text)) return "tracking_delay";
  if (/\b(?:where is|where's|track|tracking|status of|order status|has my order shipped|is my order shipped|is my order still processing|is my order on the way|when will (?:my )?(?:order|package|parcel) arrive|when is my delivery due|any update on my order|what carrier|find (?:my )?tracking number|proof of delivery|forgot what email i used|forgot which email i used|two tracking numbers|arrive together|ship separately|supposed to (?:arrive|be delivered)|expected to (?:arrive|be delivered))\b|\border\b.{0,35}\b(?:shipped|shipping|processing|on the way)\b/i.test(text)) return "order_status";
  if (/\b(?:my|our|the|this|an?)\s+(?:recent\s+)?(?:order|purchase)\b/i.test(text) && /\b(?:arrive|arrived|delivery|delivered|shipment|shipping|tracking|shipped|parcel|package)\b/i.test(text)) return "order_status";
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
  if (isPolicyIntent(latest) || isOrderDeliveryQuestion(latest)) return latest;
  return isConversationalFollowup && previousUserMessage
    ? `${previousUserMessage}\n${latest}`.slice(0, 1000)
    : latest;
}

export function filterKnowledgeForIntent(rows = [], policyIntent = false) {
  return policyIntent
    ? rows.filter((row) => ["policy", "page", "faq", "custom"].includes(row.source_type))
    : rows;
}

export function isOrderDeliveryQuestion(message = "") {
  return /\b(?:order|ordered|tracking|track|shipment|delivery|delivered|arrive|arrival|parcel|package|courier|carrier|shipped|dispatch)\b|\bonly\s+(?:one|part|some)\s+(?:of\s+)?(?:the\s+)?(?:items?|products?).{0,35}\b(?:arrived|came|received)\b|অর্ডার|ট্র্যাক|পার্সেল|ডেলিভারি/i.test(String(message || ""));
}
