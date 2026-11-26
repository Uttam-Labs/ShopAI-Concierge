const POLICY_INTENT = /\b(policy|policies|shipping|delivery|return|returns|refund|exchange|send\s+(?:it\s+)?back|send\s+back|doesn['’]?t\s+fit|too\s+(?:big|small)|cancel|cancellation|privacy|terms|warranty|guarantee|payment|dispatch)\b|নীতি|শিপিং|ডেলিভারি|ফেরত|রিটার্ন|রিফান্ড|বাতিল|গোপনীয়তা|পেমেন্ট|ওয়ারেন্টি/i;

const SUPPORT_REQUEST_INTENT = /\b(?:contact\s+(?:(?:the|your)\s+)?(?:store\s+)?support|customer\s+support|support\s+team|talk\s+to\s+(?:a\s+)?(?:human|person|someone|agent)|speak\s+to\s+(?:a\s+)?(?:human|person|someone|agent)|real\s+person|live\s+agent|human\s+help|someone\s+from\s+(?:the\s+)?(?:store|support)\s+team|help\s+from\s+(?:the\s+)?support)\b|সাপোর্টের সাথে কথা|মানুষের সাথে কথা/i;
const SUPPORT_ESCALATION_INTENT = /\b(refund not received|dispute|chargeback|angry|frustrated|unacceptable|complaint|broken|damaged)\b/i;

export function isPolicyIntent(message) {
  return POLICY_INTENT.test(String(message || ""));
}

export function isSupportRequestIntent(message) {
  return SUPPORT_REQUEST_INTENT.test(String(message || ""));
}

export function isSupportEscalationIntent(message) {
  return SUPPORT_ESCALATION_INTENT.test(String(message || ""));
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
