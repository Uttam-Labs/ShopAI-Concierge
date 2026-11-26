export const DEFAULT_CONVERSATION_FLOWS = [
  {
    id: "welcome",
    name: "Welcome & quick actions",
    description: "A friendly hello with shortcuts to shopping, order updates, and support.",
    enabled: true,
    priority: 10,
    triggerTerms: ["hi", "hello", "hey", "hiya", "howdy", "good morning", "good afternoon", "good evening", "welcome", "start", "help me", "i need help", "can you help me", "give me options", "show me options", "what can you help me with", "what can you do", "are you a human", "i want to talk to someone"],
    steps: [{
      id: "start",
      title: "Welcome",
      prompt: "Hi there! 👋 Welcome to our store. I’m your AI shopping assistant. I can help you find products, check or request a change to an order, ask about returns and refunds, or contact our support team. How can I help you today?",
      choices: [
        { id: "products", label: "Find a product", nextFlowId: "product-discovery", nextStepId: "brief" },
        { id: "orders", label: "Track my order", nextFlowId: "order-updates", nextStepId: "start" },
        { id: "returns", label: "Return or exchange", nextFlowId: "returns-support", nextStepId: "reason" },
        { id: "problem", label: "Report a problem", nextFlowId: "returns-support", nextStepId: "reason" },
        { id: "cancel", label: "Cancel an order", nextFlowId: "order-cancellation", nextStepId: "start" },
        { id: "support", label: "Contact support", action: "openSupport", requestTypeId: "other", reply: "Of course. I’ll open a support request so our team can help." },
        { id: "other", label: "Something else", nextStepId: "general-inquiry" },
      ],
    }, {
      id: "general-inquiry",
      title: "General inquiry",
      prompt: "Of course! Please tell me what you need help with. I’ll do my best to assist you.",
      inputAction: "continueAI",
      routes: [
        { id: "hours", keywords: ["store hours", "opening hours", "business hours", "what time do you open"], reply: "Our store hours are available on our website. I’ll check the store information for you.", action: "continueAI" },
        { id: "international-shipping", keywords: ["international shipping", "ship internationally", "shipping to another country"], reply: "Let me check the store’s international shipping policy for you.", action: "continueAI" },
        { id: "payment-methods", keywords: ["payment methods", "payment options", "which cards", "how can i pay"], reply: "Let me check the payment methods listed by the store.", action: "continueAI" },
        { id: "offers", keywords: ["ongoing offers", "current offers", "promotions", "discounts", "special offers"], reply: "I’ll check the promotions and offers available in the store information.", action: "continueAI" },
        { id: "human-agent", keywords: ["speak with a human", "human agent", "talk to a person", "speak to an agent", "real person"], reply: "Absolutely. I can help connect you with our support team.", action: "openSupport", requestTypeId: "other" },
      ],
    }],
  },
  {
    id: "product-discovery",
    name: "Product discovery",
    description: "Collects a useful product brief, then hands it to catalog-aware AI search.",
    enabled: true,
    priority: 30,
    triggerTerms: ["help me choose", "help me find a product", "recommend something", "recommend a product", "not sure what to buy", "looking for a product", "show me products", "do you sell", "best product", "product for me", "shopping for", "waterproof jackets", "products under $100", "in medium", "best selling product", "similar products", "compare these products", "product details", "is this in stock", "another color", "i want to buy", "i would like to buy", "want to purchase", "buy this product", "product sku", "sku", "product code"],
    steps: [{
      id: "brief",
      title: "Product search",
      prompt: "I’d be happy to help you find the right product! What are you looking for today? You can tell me the product name, category, preferred size, color, or budget.",
      inputAction: "continueAI",
      routes: [
        { id: "purchase-intent", keywords: ["i want to buy", "i would like to buy", "want to purchase", "buy this product", "i want this", "i will buy"], reply: "I’d be happy to help with that. I’ll look for the product in this store and show you the closest match so you can confirm before checkout.", action: "continueAI" },
        { id: "sku-or-title", keywords: ["sku", "product code", "product title", "iphone-123"], reply: "Thanks — I’ll search the store catalog for that product name or SKU.", action: "continueAI" },
        { id: "waterproof-jacket", keywords: ["waterproof jacket", "waterproof jackets", "waterproof coat"], reply: "Sure! Let me find available waterproof jackets for you.", action: "continueAI" },
        { id: "budget", keywords: ["under $100", "under 100", "below $100", "within my budget"], reply: "Absolutely! I’ll look for products within your budget.", action: "continueAI" },
        { id: "size-medium", keywords: ["in medium", "size medium", "available in medium", "size m"], reply: "Let me check which products have a Medium variant available.", action: "continueAI" },
        { id: "best-seller", keywords: ["best selling product", "best seller", "popular product", "most popular"], reply: "I’ll look for popular products using the store’s product information.", action: "continueAI" },
        { id: "recommendation", keywords: ["recommend a product", "which product would you recommend", "what do you recommend"], reply: "I’d be happy to recommend products based on what you need. Tell me your preferences and I’ll search the catalog.", action: "continueAI" },
        { id: "color", keywords: ["another color", "different color", "other colours", "other colors"], reply: "Let me check which colors are available for this product.", action: "continueAI" },
        { id: "availability", keywords: ["in stock", "available", "stock availability", "is this available"], reply: "I’ll check the current availability shown for the product variants.", action: "continueAI" },
        { id: "similar", keywords: ["similar products", "something similar", "similar item", "alternative product"], reply: "Absolutely! I’ll look for similar products in the store catalog.", action: "continueAI" },
        { id: "compare", keywords: ["difference between", "compare these", "compare products", "compare their features"], reply: "I’ll compare the product details and features available in the store information.", action: "continueAI" },
        { id: "details", keywords: ["product details", "more details", "tell me more about this", "specifications"], reply: "Sure! I’ll show the product details available from the store.", action: "continueAI" },
      ],
    }],
  },
  {
    id: "order-updates",
    name: "Order updates",
    description: "Routes tracking and cancellation questions to the verified order lookup or support team.",
    enabled: true,
    priority: 70,
    triggerTerms: ["track my order", "track order", "order tracking", "order status", "where is my order", "order update", "has my order shipped", "when will my order arrive", "can you track my order", "update on my order", "order history", "my recent orders", "previous orders", "check my purchase", "shipment status", "delivery status", "tracking number", "change shipping address", "partial order", "order says delivered", "wrong email"],
    steps: [{
      id: "start",
      title: "Order help",
      prompt: "Sure! I’d be happy to help check your order. Choose a secure order lookup, or tell me what you need help with.",
      choices: [
        { id: "history", label: "View order history", action: "openSupport", requestTypeId: "order-delivery", details: "Customer asked to view recent orders. Please verify their checkout email and help locate their order history.", reply: "I can help the team locate your recent orders. I’ll open a support request so they can verify your account." },
        { id: "track", label: "Track my order", action: "openOrderTracking", reply: "I’d be happy to check that. Enter your order number and the email used at checkout in the secure lookup." },
        { id: "status", label: "Check order status", action: "openOrderTracking", reply: "I’ll check the latest order status. Please enter your order number and checkout email." },
        { id: "cancel", label: "Cancel an order", nextFlowId: "order-cancellation", nextStepId: "start" },
        { id: "issue", label: "Report an order issue", nextFlowId: "returns-support", nextStepId: "reason" },
        { id: "other", label: "Other order question", nextStepId: "general-order-question" },
      ],
      routes: [
        { id: "order-track", keywords: ["where is my order", "track my order", "tracking number", "has my order been shipped", "order status", "when will my order arrive", "late delivery", "order has not arrived", "wrong email", "change shipping address", "partial order", "delivered but not received", "any update on my recent purchase", "what is happening with my order"], reply: "I’d be happy to check that. Please enter your order number and the email used at checkout in the secure lookup.", action: "openOrderTracking" },
        { id: "order-history", keywords: ["previous orders", "order history", "recent orders", "past orders"], reply: "I can help the team locate your recent orders. I’ll open a support request so they can verify your account.", action: "openSupport", requestTypeId: "order-delivery", details: "Customer asked to view recent order history. Please verify their checkout email and help locate their orders." },
        { id: "order-cancel", keywords: ["cancel my order", "cancel order", "cancellation", "please cancel my order", "changed my mind", "placed an order by mistake", "stop my order"], reply: "I can help you submit a cancellation request. The Support Team will review it; this will not cancel the order automatically.", nextFlowId: "order-cancellation", nextStepId: "start" },
        { id: "order-issue", keywords: ["order issue", "missing item", "order is damaged", "delivered but not received", "only part of my order"], reply: "I’m sorry about the trouble. I’ll help you report this order issue.", nextFlowId: "returns-support", nextStepId: "reason" },
        { id: "order-other", keywords: ["other order question", "question about my order"], reply: "Please tell me a little more, and I’ll check the store information or help you reach the team.", nextStepId: "general-order-question" },
      ],
    }, {
      id: "general-order-question",
      title: "Other order question",
      prompt: "Please tell me what you’d like to know about the order. I’ll check the store information and help with the next step.",
      inputAction: "continueAI",
      routes: [{ id: "order-address-question", keywords: ["change address", "shipping address", "wrong address"], reply: "I’ll check whether the store information explains when a shipping address can be changed.", action: "continueAI" }],
      }, {
        id: "followup",
        title: "Order follow-up",
        prompt: "Is there anything else you’d like to know about your verified order? I can help with its tracking, status, payment, or connect you with the store team.",
        routes: [
      { id: "cancel-order", keywords: ["cancel my order", "cancel order", "cancellation", "stop my order"], reply: "I can help submit a cancellation request for this order. The Support Team will review it, and the order will remain active until they confirm any change.", nextFlowId: "order-cancellation", nextStepId: "reason" },
          { id: "delivery-issue", keywords: ["delayed", "late", "not arrived", "missing item", "only one item", "tracking number is not working", "tracking isn't working", "shipping issue", "delivery problem"], reply: "I’m sorry about the trouble. I can send the verified order details and your concern to the Support Team.", action: "openSupport", requestTypeId: "order-delivery" },
          { id: "order-followup-ai", keywords: ["where is my package", "why has not my order shipped", "why hasn't my order shipped", "when will my order arrive", "tracking link", "payment received", "has my payment been received", "order status", "shipment status", "delivery status", "follow up"], reply: "Answer only from the latest verified Shopify order facts included below. Do not estimate a delivery date unless Shopify provides one. If the order facts do not answer the question, say so and offer to contact support.", action: "continueAI" },
        ],
    }],
  },
  {
    id: "returns-support",
    name: "Returns & product issues",
    description: "A calm issue-triage flow for quality concerns, returns, exchanges, delivery, and damaged items.",
    enabled: true,
    priority: 100,
    triggerTerms: ["frustrated", "angry", "upset", "unhappy", "i am not feeling good", "i'm not feeling good", "im not feeling good", "i feel bad", "not doing well", "something happened", "bad quality", "poor quality", "low quality", "product is bad", "damaged", "broken", "wrong item", "missing item", "return", "exchange", "refund", "complaint", "not satisfied", "disappointed", "late delivery", "never arrived", "need to return", "want a refund"],
    steps: [
      {
        id: "reason",
        title: "Understand the issue",
        prompt: "I’m sorry this hasn’t gone as you expected. Could you tell me a little more about what happened? For example, was there a quality, delivery, or order issue?",
        choices: [
          { id: "quality", label: "Product quality", nextStepId: "quality" },
          { id: "return", label: "I want to return it", nextStepId: "return-details" },
          { id: "delivery", label: "Delivery or order issue", nextStepId: "delivery-details" },
          { id: "damaged", label: "Wrong, missing, or damaged item", nextStepId: "item-details" },
        ],
        routes: [
          { id: "quality", keywords: ["quality", "poor quality", "bad quality", "very bad", "defect", "defective", "not as expected", "doesn't match description", "does not match description", "stopped working"], reply: "I’m sorry the product hasn’t met your expectations. Which item is affected, and would you prefer help with a return or another resolution?", nextStepId: "quality" },
          { id: "return", keywords: ["return", "refund", "money back", "send it back"], reply: "I can help start a return request. Which product would you like the team to review?", nextStepId: "return-details" },
          { keywords: ["delivery", "shipping", "shipment"], nextStepId: "delivery-details" },
          { id: "damaged", keywords: ["damaged", "arrived broken", "broken", "wrong product", "wrong item", "missing", "not received", "never arrived"], reply: "I’m sorry about that. Please tell me which item was affected and, if you have it, your order number. I’ll help send the details to the store team.", nextStepId: "item-details" },
          { id: "unclear-issue", keywords: ["something else", "other issue", "not sure", "help", "it is bad", "bad experience"], reply: "I’m sorry you’re dealing with this. Could you share which product is involved and what happened? A few details will help me point you to the right next step.", action: "continueAI" },
        ],
      },

      {
        id: "quality",
        title: "Quality concern",
        prompt: "I’m sorry the product quality wasn’t what you expected. Would you like help asking the store team about a return, or would you prefer to tell me more about the issue first? I can check the store’s current policy before suggesting what’s available.",
        choices: [
          { id: "yes-return", label: "Yes, ask about a return", nextStepId: "return-details" },
          { id: "exchange", label: "I was hoping to exchange it", nextStepId: "exchange-info" },
          { id: "no-thanks", label: "No, thanks", nextStepId: "done" },
        ],
        routes: [
          { keywords: ["yes", "return", "sure", "please do"], nextStepId: "return-details" },
          { keywords: ["exchange", "replace"], nextStepId: "exchange-info" },
          { keywords: ["no", "not now", "no thanks"], nextStepId: "done" },
        ],
      },
      {
        id: "exchange-info",
        title: "Exchange guidance",
        prompt: "I understand. We can’t arrange an exchange in this chat, so the next step is to ask the store team about returning it. Would you like me to open that request?",
        choices: [
          { id: "yes", label: "Yes, continue with a return", nextStepId: "return-details" },
          { id: "no", label: "No, I’ll decide later", nextStepId: "done" },
        ],
        routes: [
          { keywords: ["yes", "continue", "return", "please do"], nextStepId: "return-details" },
          { keywords: ["no", "later", "not now"], nextStepId: "done" },
        ],
      },
      {
        id: "return-details",
        title: "Return details",
        prompt: "Which product would you like to return? Add the order number too if you have it.",
        inputAction: "openSupport",
        inputReply: "Thanks for sharing that. I’ll open a return request for the store team.",
        requestTypeId: "returns-refunds",
        detailsPrefix: "Return request: ",
        followupStepId: "after-ticket",
      },
      {
        id: "delivery-details",
        title: "Delivery details",
        prompt: "Please share the order number and what happened with delivery.",
        inputAction: "openSupport",
        inputReply: "Thanks for sharing that. I’ll open a support request about the delivery issue.",
        requestTypeId: "order-delivery",
        detailsPrefix: "Delivery issue: ",
        followupStepId: "after-ticket",
      },
      {
        id: "item-details",
        title: "Item details",
        prompt: "Please tell me which product was wrong or damaged and include your order number if available.",
        inputAction: "openSupport",
        inputReply: "Thanks for sharing that. I’ll open a support request so the team can review the item issue.",
        requestTypeId: "product-support",
        detailsPrefix: "Wrong or damaged item: ",
        followupStepId: "after-ticket",
      },
      {
        id: "after-ticket",
        title: "After ticket creation",
        prompt: "Your request is with the store team. Would you also like me to look for products from the store catalog that may suit you?",
        choices: [
          { id: "related-products", label: "Yes, find related products", action: "continueAI" },
          { id: "no-products", label: "No thanks", nextStepId: "done" },
        ],
      },
      {
        id: "done",
        title: "Finish",
        prompt: "Of course. Take your time. If you need anything else, I’m here to help.",
      },
    ],
  },
  {
    id: "order-cancellation",
    name: "Order cancellation request",
    description: "Collects and verifies order details, prepares a cancellation request, and gets customer confirmation before sending it to support. It never cancels a Shopify order.",
    enabled: true,
    priority: 110,
    triggerTerms: ["cancel my order", "cancel order", "cancel an order", "cancel this order", "cancel the order", "cancel my purchase", "please cancel my order", "can you help me cancel", "i'd like to cancel", "i would like to cancel", "i need to cancel an order", "order cancellation", "cancellation request", "i want to cancel", "i don't want my order anymore", "i changed my mind", "placed an order by mistake", "i want to stop my order", "cancel my recent purchase", "i no longer need this product", "don't want the package delivered", "request an order cancellation", "withdraw my purchase", "cancel my purchase urgently", "cancel duplicate order", "cancel second order", "cancel one item", "cancel part of my order", "cancel entire order", "cancel full order", "cancel before shipping", "cancel after shipping", "don't cancel my order", "withdraw cancellation request", "refund for cancellation", "cancellation policy", "modify my order", "change my order", "wrong size order"],
    steps: [
      {
        id: "start",
        title: "Cancellation request",
        prompt: "I can help submit an order cancellation request. The Support Team will review it and contact you. Submitting a request does not cancel your order. Please share the order number so I can securely identify it.",
        captureField: "orderNumber",
        nextStepId: "order-email",
        routes: [
          { id: "modify-instead", keywords: ["change my order", "modify my order", "change size", "change color", "wrong address", "update shipping address", "change quantity", "replace one product"], reply: "I can include an order modification request for the Support Team to review. I won’t change the Shopify order. First, please share the order number and checkout email so I can verify it.", nextStepId: "order-number", setData: { requestMode: "modification" } },
          { id: "duplicate-order", keywords: ["duplicate order", "ordered twice", "charged twice", "same order twice", "second order"], reply: "I can help request a review of a duplicate order. Please share both order numbers and tell me which order you want the team to review for cancellation.", nextStepId: "duplicate-orders" },
        { id: "cancel-policy", keywords: ["cancellation policy", "cancellation fee", "can i cancel", "eligible for cancellation", "cancel after shipping", "cancel after dispatch", "refund for cancellation", "when will i receive my refund", "refund timeline", "full refund", "shipping fee refunded", "taxes refunded", "refund to another card", "gift card balance", "partial refund", "cod order", "already processed", "left the warehouse", "out for delivery", "stop the delivery", "how long does cancellation take", "still being packed", "cancellation rejected"], reply: "I can check the store’s published cancellation or refund policy. The Support Team must confirm eligibility, fees, and timing for your specific order; I can’t promise that an order can be cancelled or refunded.", action: "continueAI" },
          { id: "support-handoff", keywords: ["speak to a human", "talk to customer support", "human assistance", "contact support", "cancellation team", "speak to your manager"], reply: "I can forward your cancellation question to the Support Team. Please add any order or request reference you have.", action: "openSupport", requestTypeId: "order-delivery" },
        ],
      },
      { id: "order-number", title: "Identify the order", prompt: "Please enter the order number. You can find it in your order confirmation email. I’ll also need the email address used at checkout to verify it.", captureField: "orderNumber", nextStepId: "order-email", routes: [{ id: "no-order-number", keywords: ["i don't know my order number", "i do not know my order number", "can't find my order number", "only have payment reference", "guest checkout", "find order using my email", "can you check my recent order", "multiple orders", "which order details", "cannot find my order confirmation", "different email", "find my purchase details", "don't have my order id", "order history", "phone number instead"], reply: "For privacy, I need the order number and checkout email to verify the order here. If you can’t find the number, please use the order confirmation email or contact the store team. A phone number or payment reference alone isn’t enough for this secure lookup.", nextStepId: "order-number" }] },
      { id: "order-email", title: "Verify checkout email", prompt: "What email address did you use when placing the order? I’ll check that it matches before showing order details or preparing the request.", captureField: "orderEmail", nextStepId: "verify-order" },
      { id: "verify-order", title: "Verify order", prompt: "Thank you. I’m securely checking the order number and checkout email.", inputAction: "verifyCancellationOrder" },
      { id: "duplicate-orders", title: "Identify the duplicate order", prompt: "Please provide both order numbers, then tell me which one you want the Support Team to review for cancellation.", captureField: "duplicateOrderNumbers", nextStepId: "duplicate-selected" },
      { id: "duplicate-selected", title: "Select the order", prompt: "Which specific order number should the Support Team review for cancellation?", captureField: "orderNumber", nextStepId: "order-email" },
      { id: "reason", title: "Cancellation reason", prompt: "May I know why you’d like to cancel? This helps the Support Team review your request. You can also skip this question.", captureField: "reason", nextStepId: "scope", choices: [{ id: "skip-reason", label: "Skip reason", captureField: "reason", captureValue: "Not provided", nextStepId: "scope" }], routes: [{ id: "skip-reason-text", keywords: ["skip", "prefer not to say", "don't want to explain", "do not want to explain"], reply: "That’s okay. You don’t have to share a reason.", nextStepId: "scope" }] },
      { id: "scope", title: "Choose cancellation scope", prompt: "Would you like the Support Team to review cancellation of the entire order or only specific item(s)?", choices: [{ id: "full-order", label: "Entire order", captureField: "scope", captureValue: "Full order", nextStepId: "shipping-status" }, { id: "partial-order", label: "Specific item(s)", captureField: "scope", captureValue: "Partial order", nextStepId: "partial-items" }, { id: "modify-order", label: "Request a change instead", captureField: "scope", captureValue: "Order modification", nextStepId: "modification-details" }] },
      { id: "partial-items", title: "Items to review", prompt: "Which product(s) and quantities would you like the Support Team to review? Partial cancellation depends on the team’s review.", captureField: "items", nextStepId: "shipping-status" },
      { id: "shipping-status", title: "Shipping status", prompt: "Do you know whether the order has shipped or whether you’ve received it? This helps the Support Team review available options.", choices: [{ id: "not-shipped", label: "Not shipped yet", captureField: "shippingStatus", captureValue: "Customer says not shipped", nextStepId: "review" }, { id: "shipped", label: "Already shipped", captureField: "shippingStatus", captureValue: "Customer says shipped", nextStepId: "review" }, { id: "received", label: "I received it", captureField: "shippingStatus", captureValue: "Customer says received", nextStepId: "received-support" }, { id: "unsure", label: "I’m not sure", captureField: "shippingStatus", captureValue: "Customer is unsure", nextStepId: "review" }], routes: [{ id: "shipped-question", keywords: ["shipped", "dispatched", "out for delivery", "in transit", "already received", "not received", "refuse the package", "return the product", "contact the courier", "intercept my shipment"], reply: "Thanks. If an order has shipped, cancellation may have additional restrictions. The Support Team will review the order status and available options; I can’t promise a shipment can be stopped or intercepted.", nextStepId: "review" }] },
      { id: "review", title: "Review request summary", prompt: "Please review your request before I send it to the Support Team.", choices: [{ id: "submit-cancellation", label: "Yes, continue to submit", action: "openSupport", requestTypeId: "order-delivery", reply: "Your cancellation request details are ready. Review them in the form and submit it to the Support Team. Your order has not been cancelled.", followupStepId: "after-ticket" }, { id: "decline-cancellation", label: "No, don’t submit", nextStepId: "cancelled" }] },
      { id: "modification-details", title: "Order change details", prompt: "What would you like to change? I’ll send the request to the Support Team; I won’t modify the Shopify order.", captureField: "modification", nextStepId: "modification-review" },
      { id: "modification-review", title: "Review order change request", prompt: "Please confirm that you want me to send this order change request to the Support Team.", choices: [{ id: "submit-modification", label: "Continue to submit change request", action: "openSupport", requestTypeId: "order-delivery", followupStepId: "after-ticket", reply: "Your order change request details are ready. Review them in the form and submit them to the Support Team. The order has not been modified." }, { id: "decline-modification", label: "Don’t submit", nextStepId: "cancelled" }] },
      { id: "cancelled", title: "Request not submitted", prompt: "Okay, I haven’t submitted a cancellation request. Your order hasn’t been changed. You can contact the store team if you need help later." },
      { id: "after-ticket", title: "Request submitted", prompt: "Your request has been sent to the Support Team. The order remains active until the team reviews and confirms any cancellation. You can ask to submit a withdrawal request if you change your mind.", choices: [{ id: "withdraw", label: "Ask to withdraw request", nextStepId: "withdraw-confirm" }, { id: "finish", label: "I’m done", nextStepId: "done" }], routes: [{ id: "withdraw-request", keywords: ["don't cancel", "do not cancel", "withdraw cancellation", "keep my order", "changed my mind", "stop cancellation request", "no longer want to cancel"], reply: "I can forward a withdrawal request to the Support Team. They may already be reviewing or processing the original request.", nextStepId: "withdraw-confirm" }] },
      { id: "withdraw-confirm", title: "Confirm withdrawal request", prompt: "Would you like me to send the Support Team a request to withdraw the cancellation request? The team’s current review status may affect whether it can be stopped.", choices: [{ id: "submit-withdrawal", label: "Continue to submit withdrawal request", action: "openSupport", requestTypeId: "order-delivery", reply: "Your withdrawal request details are ready. Review them in the form and submit them to the Support Team. They’ll confirm whether the original request can still be stopped.", details: "Customer asks to withdraw the cancellation request. Do not cancel, modify, or promise to stop the order." }, { id: "decline-withdrawal", label: "Keep cancellation request", nextStepId: "done" }] },
      { id: "done", title: "Finish", prompt: "Thanks for contacting us. Is there anything else I can help with?" },
    ],
  },
];

const cleanText = (value, fallback, max = 500) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;

export function normalizeConversationFlows(value) {
  const savedFlows = Array.isArray(value) ? value : [];
  return DEFAULT_CONVERSATION_FLOWS.map((defaults) => {
    const saved = savedFlows.find((flow) => flow?.id === defaults.id) || {};
    const savedSteps = Array.isArray(saved.steps) ? saved.steps : [];
    const allowedTriggers = Array.isArray(saved.triggerTerms) ? saved.triggerTerms : typeof saved.triggerTerms === "string" ? saved.triggerTerms.split(",") : defaults.triggerTerms;
    const triggerTerms = [...new Set([...allowedTriggers, ...defaults.triggerTerms].map((term) => String(term || "").trim().slice(0, 80)).filter(Boolean))];
    return {
      ...defaults,
      name: cleanText(saved.name, defaults.name, 80),
      description: cleanText(saved.description, defaults.description, 220),
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : defaults.enabled,
      triggerTerms,
      steps: defaults.steps.map((step) => {
        const savedStep = savedSteps.find((candidate) => candidate?.id === step.id) || {};
        const savedChoices = Array.isArray(savedStep.choices) ? savedStep.choices : [];
        const savedRoutes = Array.isArray(savedStep.routes) ? savedStep.routes : [];
        const defaultRoutes = step.routes || [];
        const sourceRoutes = [
          ...defaultRoutes.map((defaultRoute, index) => savedRoutes.find((candidate) => candidate?.id === defaultRoute.id) || (savedRoutes[index] && !savedRoutes[index].id ? { ...defaultRoute, ...savedRoutes[index] } : defaultRoute)),
          ...savedRoutes.filter((candidate) => candidate?.id && !defaultRoutes.some((defaultRoute) => defaultRoute.id === candidate.id)),
        ];
        return {
          ...step,
          prompt: cleanText(savedStep.prompt, step.prompt, 1000),
          ...(step.inputReply ? { inputReply: cleanText(savedStep.inputReply, step.inputReply, 500) } : {}),
          ...(step.followupStepId ? { followupStepId: step.followupStepId } : {}),
          routes: sourceRoutes.slice(0, 40).map((route, index) => {
            const defaultRoute = (step.routes || []).find((candidate) => candidate.id && candidate.id === route?.id) || (step.routes || [])[index] || {};
            const keywords = Array.isArray(route?.keywords) ? route.keywords : defaultRoute.keywords || [];
            const action = ["continueAI", "openOrderTracking", "openSupport"].includes(route?.action) ? route.action : route?.action === "" ? "" : defaultRoute.action;
            const nextFlowId = route?.nextFlowId === "" ? "" : ["welcome", "product-discovery", "order-updates", "order-cancellation", "returns-support"].includes(route?.nextFlowId) ? route.nextFlowId : defaultRoute.nextFlowId;
            const targetFlow = DEFAULT_CONVERSATION_FLOWS.find((candidate) => candidate.id === (nextFlowId || defaults.id));
            const nextStepId = route?.nextStepId === "" ? "" : typeof route?.nextStepId === "string" && targetFlow?.steps.some((candidate) => candidate.id === route.nextStepId) ? route.nextStepId : defaultRoute.nextStepId;
            return {
              ...defaultRoute,
              ...route,
              id: cleanText(route?.id, `question-${index + 1}`, 80),
              keywords: [...new Set(keywords.map((phrase) => String(phrase || "").trim().slice(0, 100)).filter(Boolean))].slice(0, 30),
              reply: typeof route?.reply === "string" ? route.reply.trim().slice(0, 500) : defaultRoute.reply || "",
              ...(action ? { action } : {}),
              ...(nextFlowId ? { nextFlowId } : {}),
              ...(nextStepId ? { nextStepId } : {}),
              ...(route?.requestTypeId || defaultRoute.requestTypeId ? { requestTypeId: String(route?.requestTypeId || defaultRoute.requestTypeId).slice(0, 80) } : {}),
              ...(route?.details || defaultRoute.details ? { details: String(route?.details || defaultRoute.details).slice(0, 500) } : {}),
            };
          }),
          choices: step.choices?.map((choice) => {
            const savedChoice = savedChoices.find((candidate) => candidate?.id === choice.id) || {};
            const action = ["continueAI", "openOrderTracking", "openSupport"].includes(savedChoice.action) ? savedChoice.action : savedChoice.action === "" ? "" : choice.action;
            const nextFlowId = savedChoice.nextFlowId === "" ? "" : ["welcome", "product-discovery", "order-updates", "order-cancellation", "returns-support"].includes(savedChoice.nextFlowId) ? savedChoice.nextFlowId : choice.nextFlowId;
            const targetFlow = DEFAULT_CONVERSATION_FLOWS.find((candidate) => candidate.id === (nextFlowId || defaults.id));
            const nextStepId = savedChoice.nextStepId === "" ? "" : typeof savedChoice.nextStepId === "string" && targetFlow?.steps.some((candidate) => candidate.id === savedChoice.nextStepId) ? savedChoice.nextStepId : choice.nextStepId;
            return { ...choice, ...savedChoice, label: cleanText(savedChoice.label, choice.label, 100), ...(typeof savedChoice.reply === "string" ? { reply: savedChoice.reply.trim().slice(0, 500) } : choice.reply ? { reply: choice.reply } : {}), ...(action ? { action } : {}), ...(nextFlowId ? { nextFlowId } : {}), ...(nextStepId ? { nextStepId } : {}), ...(savedChoice.requestTypeId || choice.requestTypeId ? { requestTypeId: String(savedChoice.requestTypeId || choice.requestTypeId).slice(0, 80) } : {}), ...(savedChoice.details || choice.details ? { details: String(savedChoice.details || choice.details).slice(0, 500) } : {}) };
          }).concat(savedChoices.filter((choice) => choice?.id && !step.choices?.some((candidate) => candidate.id === choice.id))),
        };
      }),
    };
  });
}

function normalizeForMatch(value) {
  return String(value || "").toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function includesTerm(message, term) {
  const normalizedMessage = ` ${normalizeForMatch(message)} `;
  const normalizedTerm = normalizeForMatch(term);
  return normalizedTerm.length >= 2 && normalizedMessage.includes(` ${normalizedTerm} `);
}

function cancellationRequestDetails(data = {}) {
  const order = data.verifiedOrder || {};
  return [
    "Cancellation request — review only; do not automatically cancel or modify the Shopify order.",
    `Verified order: ${order.name || data.orderNumber || "Not verified"}`,
    `Checkout email: ${data.orderEmail || "Not provided"}`,
    `Request scope: ${data.scope || "Not selected"}`,
    data.items ? `Items and quantities: ${data.items}` : "",
    `Customer reason: ${data.reason || "Not provided"}`,
    `Shipping situation: ${data.shippingStatus || "Not provided"}`,
    data.modification ? `Requested change instead: ${data.modification}` : "",
    data.duplicateOrderNumbers ? `Related duplicate order numbers: ${data.duplicateOrderNumbers}` : "",
    order.fulfillmentStatus ? `Verified fulfillment status: ${order.fulfillmentStatus}` : "",
    order.tracking?.length ? `Verified tracking: ${order.tracking.map((item) => [item.company, item.number, item.url].filter(Boolean).join(" ")).join("; ")}` : "",
  ].filter(Boolean).join("\n");
}

function promptForFlowStep(flow, step, data = {}) {
  if (flow.id === "order-cancellation" && step.id === "after-ticket") {
    return `Your request has been sent to the Support Team${data.requestReference ? ` (reference ${data.requestReference})` : ""}. The order remains active until the team reviews and confirms any cancellation. You can ask to submit a withdrawal request if you change your mind.`;
  }
  if (flow.id === "order-cancellation" && step.id === "review") {
    const order = data.verifiedOrder || {};
    return [
      "Please review your cancellation request before I send it to the Support Team:",
      `Order: ${order.name || data.orderNumber || "Not verified"}`,
      order.createdAt ? `Order date: ${new Date(order.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}` : "",
      order.fulfillmentStatus ? `Fulfillment status: ${order.fulfillmentStatus}` : "",
      `Request: ${data.scope || "Not selected"}`,
      data.items ? `Items and quantities: ${data.items}` : "",
      `Reason: ${data.reason || "Not provided"}`,
      `Shipping situation: ${data.shippingStatus || "Not provided"}`,
      "Submitting sends a request for review; it does not cancel the order.",
      "Would you like me to submit this request?",
    ].filter(Boolean).join("\n");
  }
  if (flow.id === "order-cancellation" && step.id === "modification-review") {
    return [`Order: ${data.verifiedOrder?.name || data.orderNumber || "Not verified"}`, `Requested change: ${data.modification || "Not provided"}`, "Would you like me to send this change request to the Support Team?"].join("\n");
  }
  return step.prompt;
}

export function resolveConversationFlow(flows, { message, flowId, stepId, choiceId, flowData: rawFlowData }) {
  const enabledFlows = normalizeConversationFlows(flows).filter((flow) => flow.enabled);
  const allowedDataFields = ["orderNumber", "orderEmail", "reason", "scope", "items", "shippingStatus", "modification", "duplicateOrderNumbers", "requestReference", "requestMode", "orderVerified", "verifiedOrder"];
  const flowData = rawFlowData && typeof rawFlowData === "object" && !Array.isArray(rawFlowData)
    ? Object.fromEntries(allowedDataFields.filter((field) => Object.hasOwn(rawFlowData, field)).map((field) => [field, rawFlowData[field]]))
    : {};
  const flowState = (flow, step, answer = promptForFlowStep(flow, step, flowData), data = flowData) => ({
    answer,
    flow: step.choices?.length || step.routes?.length || step.inputAction || step.captureField ? { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })), data } : null,
  });
  const matchingFlow = (excludedId) => enabledFlows.map((candidate) => ({
    candidate,
    matchLength: Math.max(0, ...candidate.triggerTerms.filter((term) => includesTerm(message, term)).map((term) => normalizeForMatch(term).length)),
  })).filter(({ candidate, matchLength }) => matchLength > 0 && candidate.id !== excludedId)
    .sort((left, right) => right.matchLength - left.matchLength || right.candidate.priority - left.candidate.priority)[0]?.candidate;
  const transition = (sourceFlow, sourceStep, targetFlowId, targetStepId, reply = "", data = flowData) => {
    const targetFlow = enabledFlows.find((candidate) => candidate.id === (targetFlowId || sourceFlow.id));
    const targetStep = targetFlow?.steps.find((candidate) => candidate.id === targetStepId);
    if (!targetFlow || !targetStep) return null;
    const targetPrompt = promptForFlowStep(targetFlow, targetStep, data);
    return flowState(targetFlow, targetStep, [reply, targetPrompt].filter(Boolean).join("\n\n"), data);
  };
  const runAction = (flow, step, action, reply, config = {}) => ({
    answer: reply || step.prompt,
    action,
    flow: action === "continueAI" && config.keepFlow !== false ? flowState(flow, step).flow : null,
    flowData: config.flowData || flowData,
    requestTypeId: config.requestTypeId,
    details: config.details || (flow.id === "order-updates" && action === "openSupport" ? [
      `Customer follow-up for verified Shopify order ${flowData.verifiedOrder?.name || flowData.orderNumber || ""}.`,
      flowData.verifiedOrder?.fulfillmentStatus ? `Fulfillment status: ${flowData.verifiedOrder.fulfillmentStatus}.` : "",
      flowData.verifiedOrder?.tracking?.length ? `Tracking: ${flowData.verifiedOrder.tracking.map((item) => [item.company, item.number, item.url].filter(Boolean).join(" ")).join("; ")}.` : "",
      `Customer message: ${config.customerMessage || ""}`,
    ].filter(Boolean).join("\n") : undefined),
    followupStepId: config.followupStepId || step.followupStepId,
    flowId: config.flowId || flow.id,
    requiresVerifiedOrder: flow.id === "order-cancellation" && ["submit-cancellation", "submit-modification", "submit-withdrawal"].includes(config.id),
    clearFlow: action !== "continueAI",
  });
  const runRoute = (flow, step, route) => {
    const selected = route.choiceId ? step.choices?.find((choice) => choice.id === route.choiceId) : null;
    const action = route.action || selected?.action;
    let reply = route.reply || selected?.reply || "";
    if (flow.id === "order-updates" && flowData.verifiedOrder && action === "continueAI") {
      const order = flowData.verifiedOrder;
      const verifiedFacts = [
        `Verified Shopify order: ${order.name || ""}`,
        order.createdAt ? `Order date: ${order.createdAt}` : "",
        order.financialStatus ? `Payment status: ${order.financialStatus}` : "",
        order.fulfillmentStatus ? `Fulfillment status: ${order.fulfillmentStatus}` : "",
        order.tracking?.length ? `Tracking: ${order.tracking.map((item) => [item.company, item.number, item.url].filter(Boolean).join(" ")).join("; ")}` : "No tracking details are currently available in Shopify.",
        order.fulfillments?.some((item) => item.estimatedDeliveryAt) ? `Estimated delivery: ${order.fulfillments.filter((item) => item.estimatedDeliveryAt).map((item) => item.estimatedDeliveryAt).join(", ")}` : "Shopify has not provided an estimated delivery date.",
      ].filter(Boolean).join("\n");
      reply = `${reply}\n${verifiedFacts}`;
    }
    const nextData = { ...flowData, ...(route.setData && typeof route.setData === "object" ? route.setData : {}) };
    const config = { ...selected, ...route, flowId: flow.id, flowData: nextData, customerMessage: message };
    if (action) return runAction(flow, step, action, reply, config);
    const targetStepId = route.nextStepId || selected?.nextStepId;
    const targetFlowId = route.nextFlowId || selected?.nextFlowId;
    if (targetStepId) return transition(flow, step, targetFlowId, targetStepId, reply, nextData);
    return reply ? { answer: reply, flow: null, clearFlow: true } : null;
  };

  let flow = flowId ? enabledFlows.find((candidate) => candidate.id === flowId) : null;
  let step = flow?.steps.find((candidate) => candidate.id === stepId);
  const isContinuation = Boolean(flowId && stepId && flow && step);
  if (isContinuation && !choiceId) {
    const otherFlow = matchingFlow(flow.id);
    if (otherFlow) {
      flow = otherFlow;
      step = flow.steps[0];
      const handoffRoute = step.routes?.find((route) => route.keywords.some((keyword) => includesTerm(message, keyword)));
      if (handoffRoute) return runRoute(flow, step, handoffRoute);
      return flowState(flow, step);
    }
  }
  if (!isContinuation) {
    flow = matchingFlow("");
    if (!flow) return null;
    step = flow.steps[0];
    const initialRoute = step.routes?.find((route) => route.keywords.some((keyword) => includesTerm(message, keyword)));
    if (initialRoute) return runRoute(flow, step, initialRoute);
    if (flow.id === "order-cancellation") {
      const number = message.match(/#\s*([A-Za-z0-9-]{1,30})/)?.[1] || message.match(/\border\s*(?:number|no\.?|#)\s*([A-Za-z0-9-]{1,30})/i)?.[1];
      const email = message.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/i)?.[0]?.toLowerCase();
      if (number && email) return { answer: flow.steps.find((candidate) => candidate.id === "verify-order")?.prompt || "I’m securely checking the order details.", action: "verifyCancellationOrder", flowId: flow.id, flowData: { orderNumber: number, orderEmail: email } };
      if (number) return transition(flow, step, flow.id, "order-email", "", { orderNumber: number });
    }
    return flowState(flow, step);
  }

  const selected = step.choices?.find((choice) => choice.id === choiceId);
  if (selected) {
    const selectedData = selected.captureField ? { ...flowData, [selected.captureField]: String(selected.captureValue || "").slice(0, 500) } : flowData;
    if (selected.action) {
      const details = flow.id === "order-cancellation" && selected.id === "submit-cancellation" ? cancellationRequestDetails(selectedData)
        : flow.id === "order-cancellation" && selected.id === "submit-modification" ? `Order modification request for ${selectedData.verifiedOrder?.name || selectedData.orderNumber || "unverified order"}. Requested change: ${selectedData.modification || "Not provided"}. Do not modify the Shopify order.`
          : flow.id === "order-cancellation" && selected.id === "submit-withdrawal" ? `Withdrawal request for cancellation ticket ${selectedData.requestReference || "reference unavailable"}, order ${selectedData.verifiedOrder?.name || selectedData.orderNumber || "not verified"}. Do not cancel or modify the Shopify order.`
            : selected.details;
      return runAction(flow, step, selected.action, selected.reply, { ...selected, details, flowData: selectedData, keepFlow: false });
    }
    if (selected.nextStepId) return transition(flow, step, selected.nextFlowId, selected.nextStepId, selected.reply || "", selectedData);
  }
  const route = step.routes?.find((candidate) => candidate.keywords.some((keyword) => includesTerm(message, keyword)));
  if (route) return runRoute(flow, step, route);
  if (step.captureField) {
    let captured = String(message || "").trim().slice(0, 500);
    if (step.captureField === "orderNumber") captured = captured.match(/#\s*([A-Za-z0-9-]{1,30})/)?.[1] || captured.replace(/^order\s*(?:number|no\.?|#)?\s*/i, "").replace(/^#/, "").slice(0, 30);
    if (step.captureField === "orderEmail") captured = captured.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/i)?.[0]?.toLowerCase() || captured;
    const nextData = { ...flowData, [step.captureField]: captured };
    const nextStep = flow.steps.find((candidate) => candidate.id === step.nextStepId);
    if (nextStep?.inputAction === "verifyCancellationOrder") return { answer: nextStep.prompt, action: "verifyCancellationOrder", flowId: flow.id, flowData: nextData };
    return transition(flow, step, flow.id, step.nextStepId, "", nextData);
  }
  if (step.inputAction) {
    if (step.inputAction === "continueAI") return runAction(flow, step, "continueAI", `Continue helping the shopper with their latest message. Use this guided step as context: ${step.prompt}`, { flowData });
    if (step.inputAction === "verifyCancellationOrder") return { answer: step.prompt, action: "verifyCancellationOrder", flowId: flow.id, flowData };
    return runAction(flow, step, step.inputAction, step.inputReply || "Thanks for sharing that. I’ll use those details to help you find the right next step.", {
      requestTypeId: step.requestTypeId,
      details: `${step.detailsPrefix || ""}${String(message || "").trim().slice(0, 1500)}`,
      followupStepId: step.followupStepId,
      flowData,
    });
  }
  const handoff = matchingFlow(flow.id);
  return handoff ? flowState(handoff, handoff.steps[0]) : runAction(flow, step, "continueAI", `The shopper’s reply did not match a listed option. Respond helpfully and keep this guided step available: ${promptForFlowStep(flow, step, flowData)}`, { flowData });
}

export function getConversationFlowStep(flows, flowId, stepId, data = {}) {
  const flow = normalizeConversationFlows(flows).find((candidate) => candidate.enabled && candidate.id === flowId);
  const step = flow?.steps.find((candidate) => candidate.id === stepId);
  if (!step) return null;
  return { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })), data };
}
