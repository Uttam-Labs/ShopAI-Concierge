# Chat request routing

The storefront chat is a hybrid assistant. Deterministic rules and Shopify-backed actions remain available when the configured answer model is offline. The model improves language understanding and wording; it does not own order state or invent store policy.

## Request path

1. **Live chat** collects the customer message and sends the active flow, FAQ selection, session, and any requested action to the chat endpoint.
2. **Active flow** wins first. A flow already in progress keeps its state and handles the next reply before a new intent, FAQ, or knowledge search can take over.
3. **Rule-based intent routing** handles secure order lookup, cancellation and change requests, returns, delivery/item problems, explicit support requests, and product search. Known intents go to their guided flow or the relevant API. Unknown order requests are offered clear order-help choices instead of being guessed from unrelated documents.
4. **Approved FAQ matching** answers a close match from the merchant's active FAQ list. Explicit action requests and product searches cannot be swallowed by a merely similar FAQ.
5. **RAG retrieval** searches the merchant's indexed Shopify products, pages, policies, custom content, FAQs, and enabled flow knowledge. Retrieved content is reference material; only directly relevant facts can support store-specific answers.
6. **Optional answer model** turns the shopper's message and retrieved evidence into a concise answer or helps choose among relevant flow candidates. It cannot create order facts, promise policy outcomes, or submit a support request.
7. **Response/action handler** returns an answer, next-flow choices, secure order lookup, product cards, or an unsubmitted support form. Shopify is queried only for supported, verified actions. Cancellation and order edits are requests for team review; this chat does not claim they happened.

## AI enabled and AI unavailable

- With an answer API key, the configured provider writes grounded replies and may help interpret retrieved flow candidates.
- Without an answer API key, rule-based flows, active FAQs, catalog search, secure order lookup, and support requests still work. Knowledge search uses Gemini embeddings plus Supabase when configured; when semantic search is unavailable, the app uses its lexical knowledge fallback where configured.
- If no approved source answers a store-specific question, the assistant asks a useful follow-up or offers support. It must not use a loosely similar policy page as an answer.

## Source of truth

- **Shopify API:** live product and verified order facts.
- **Vector database / RAG:** indexed store policies, pages, products, FAQs, custom guidance, and flow documents.
- **FAQ library:** merchant-approved short answers.
- **Conversation flows:** the approved sequence of questions, choices, verification, and permitted handoffs.
- **AI provider:** intent assistance and natural-language wording only; never the source of truth for store facts.
