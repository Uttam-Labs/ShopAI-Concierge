export const DEFAULT_CONVERSATION_FLOWS = [
  {
    id: "welcome",
    name: "Welcome & quick actions",
    description: "A friendly hello with shortcuts to shopping, order updates, and support.",
    enabled: true,
    priority: 10,
    triggerTerms: ["hi", "hello", "hey", "hiya", "howdy", "good morning", "good afternoon", "good evening", "welcome", "start", "help me", "can you help me"],
    steps: [{
      id: "start",
      title: "Welcome",
      prompt: "Hi there! 👋 Welcome to our store. I’m your AI shopping assistant. I can help you find products, track an order, manage a return, or contact our support team. How can I help you today?",
      choices: [
        { id: "products", label: "Find a product", nextFlowId: "product-discovery", nextStepId: "brief" },
        { id: "orders", label: "Track my order", nextFlowId: "order-updates", nextStepId: "start" },
        { id: "returns", label: "Return or exchange", nextFlowId: "returns-support", nextStepId: "reason" },
        { id: "problem", label: "Report a problem", nextFlowId: "returns-support", nextStepId: "reason" },
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
    triggerTerms: ["track my order", "track order", "order tracking", "order status", "where is my order", "order update", "cancel my order", "cancel order", "order history", "my recent orders", "previous orders", "check my purchase", "shipment status", "delivery status", "tracking number", "change shipping address", "partial order", "order says delivered", "wrong email"],
    steps: [{
      id: "start",
      title: "Order help",
      prompt: "I can help with your orders! What would you like to do today? For a secure order lookup, I’ll ask for the order number and the email used at checkout.",
      choices: [
        { id: "history", label: "View order history", action: "openSupport", requestTypeId: "order-delivery", details: "Customer asked to view recent orders. Please verify their checkout email and help locate their order history.", reply: "I can help the team locate your recent orders. I’ll open a support request so they can verify your account." },
        { id: "track", label: "Track my order", action: "openOrderTracking", reply: "I’d be happy to check that. Enter your order number and the email used at checkout in the secure lookup." },
        { id: "status", label: "Check order status", action: "openOrderTracking", reply: "I’ll check the latest order status. Please enter your order number and checkout email." },
        { id: "cancel", label: "Ask to cancel an order", action: "openSupport", requestTypeId: "order-delivery", details: "Customer requests an order cancellation. Support team must verify ownership and actual cancellation eligibility before taking action.", reply: "I can help request a cancellation review. The store team will verify the order and confirm whether it can still be cancelled." },
        { id: "issue", label: "Report an order issue", nextFlowId: "returns-support", nextStepId: "reason" },
        { id: "other", label: "Other order question", nextStepId: "general-order-question" },
      ],
      routes: [
        { id: "order-track", keywords: ["where is my order", "track my order", "tracking number", "has my order been shipped", "order status", "when will my order arrive", "late delivery", "order has not arrived", "wrong email", "change shipping address", "partial order", "delivered but not received"], reply: "I’d be happy to check that. Please use the secure lookup with your order number and checkout email.", action: "openOrderTracking" },
        { id: "order-history", keywords: ["previous orders", "order history", "recent orders", "past orders"], reply: "I can help the team locate your recent orders. I’ll open a support request so they can verify your account.", action: "openSupport", requestTypeId: "order-delivery", details: "Customer asked to view recent order history. Please verify their checkout email and help locate their orders." },
        { id: "order-cancel", keywords: ["cancel my order", "cancel order", "cancellation"], reply: "I can help request a cancellation review. The store team will verify the order and confirm whether it can still be cancelled.", action: "openSupport", requestTypeId: "order-delivery", details: "Customer requests an order cancellation. Support team must verify ownership and actual cancellation eligibility before taking action." },
        { id: "order-issue", keywords: ["order issue", "missing item", "order is damaged", "delivered but not received", "only part of my order"], reply: "I’m sorry about the trouble. I’ll help you report this order issue.", nextFlowId: "returns-support", nextStepId: "reason" },
        { id: "order-other", keywords: ["other order question", "question about my order"], reply: "Please tell me a little more, and I’ll check the store information or help you reach the team.", nextStepId: "general-order-question" },
      ],
    }, {
      id: "general-order-question",
      title: "Other order question",
      prompt: "Please tell me what you’d like to know about the order. I’ll check the store information and help with the next step.",
      inputAction: "continueAI",
      routes: [{ id: "order-address-question", keywords: ["change address", "shipping address", "wrong address"], reply: "I’ll check whether the store information explains when a shipping address can be changed.", action: "continueAI" }],
    }],
  },
  {
    id: "returns-support",
    name: "Returns & product issues",
    description: "A calm issue-triage flow for quality concerns, returns, exchanges, delivery, and damaged items.",
    enabled: true,
    priority: 100,
    triggerTerms: ["frustrated", "angry", "upset", "unhappy", "bad quality", "poor quality", "low quality", "product is bad", "damaged", "broken", "wrong item", "missing item", "return", "exchange", "refund", "complaint", "not satisfied", "disappointed", "late delivery", "never arrived", "need to return", "want a refund"],
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
];

const cleanText = (value, fallback, max = 500) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;

export function normalizeConversationFlows(value) {
  const savedFlows = Array.isArray(value) ? value : [];
  return DEFAULT_CONVERSATION_FLOWS.map((defaults) => {
    const saved = savedFlows.find((flow) => flow?.id === defaults.id) || {};
    const savedSteps = Array.isArray(saved.steps) ? saved.steps : [];
    const allowedTriggers = Array.isArray(saved.triggerTerms) ? saved.triggerTerms : typeof saved.triggerTerms === "string" ? saved.triggerTerms.split(",") : defaults.triggerTerms;
    const triggerTerms = [...new Set(allowedTriggers.map((term) => String(term || "").trim().slice(0, 80)).filter(Boolean))].slice(0, 30);
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
          ...defaultRoutes.map((defaultRoute, index) => savedRoutes.find((candidate) => candidate?.id === defaultRoute.id) || (savedRoutes[index] && !savedRoutes[index].id ? savedRoutes[index] : defaultRoute)),
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
            const nextFlowId = route?.nextFlowId === "" ? "" : ["welcome", "product-discovery", "order-updates", "returns-support"].includes(route?.nextFlowId) ? route.nextFlowId : defaultRoute.nextFlowId;
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
            return { ...choice, label: cleanText(savedChoice.label, choice.label, 100), ...(choice.reply ? { reply: cleanText(savedChoice.reply, choice.reply, 500) } : {}) };
          }),
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

export function resolveConversationFlow(flows, { message, flowId, stepId, choiceId }) {
  const enabledFlows = normalizeConversationFlows(flows).filter((flow) => flow.enabled);
  const flowState = (flow, step, answer = step.prompt) => ({
    answer,
    flow: step.choices?.length || step.inputAction ? { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })) } : null,
  });
  const matchingFlow = (excludedId) => enabledFlows.map((candidate) => ({
    candidate,
    matchLength: Math.max(0, ...candidate.triggerTerms.filter((term) => includesTerm(message, term)).map((term) => normalizeForMatch(term).length)),
  })).filter(({ candidate, matchLength }) => matchLength > 0 && candidate.id !== excludedId)
    .sort((left, right) => right.matchLength - left.matchLength || right.candidate.priority - left.candidate.priority)[0]?.candidate;
  const transition = (sourceFlow, sourceStep, targetFlowId, targetStepId, reply = "") => {
    const targetFlow = enabledFlows.find((candidate) => candidate.id === (targetFlowId || sourceFlow.id));
    const targetStep = targetFlow?.steps.find((candidate) => candidate.id === targetStepId);
    if (!targetFlow || !targetStep) return null;
    return flowState(targetFlow, targetStep, [reply, targetStep.prompt].filter(Boolean).join("\n\n"));
  };
  const runAction = (flow, step, action, reply, config = {}) => ({
    answer: reply || step.prompt,
    action,
    requestTypeId: config.requestTypeId,
    details: config.details,
    followupStepId: config.followupStepId || step.followupStepId,
    flowId: config.flowId || flow.id,
    clearFlow: action !== "continueAI",
  });
  const runRoute = (flow, step, route) => {
    const selected = route.choiceId ? step.choices?.find((choice) => choice.id === route.choiceId) : null;
    const action = route.action || selected?.action;
    const reply = route.reply || selected?.reply || "";
    const config = { ...selected, ...route, flowId: flow.id };
    if (action) return runAction(flow, step, action, reply, config);
    const targetStepId = route.nextStepId || selected?.nextStepId;
    const targetFlowId = route.nextFlowId || selected?.nextFlowId;
    if (targetStepId) return transition(flow, step, targetFlowId, targetStepId, reply);
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
    return flowState(flow, step);
  }

  const selected = step.choices?.find((choice) => choice.id === choiceId);
  if (selected) {
    if (selected.action) return runAction(flow, step, selected.action, selected.reply, selected);
    if (selected.nextStepId) return transition(flow, step, selected.nextFlowId, selected.nextStepId, selected.reply || "");
  }
  const route = step.routes?.find((candidate) => candidate.keywords.some((keyword) => includesTerm(message, keyword)));
  if (route) return runRoute(flow, step, route);
  if (step.inputAction) {
    if (step.inputAction === "continueAI") return null;
    return runAction(flow, step, step.inputAction, step.inputReply || "Thanks for sharing that. I’ll use those details to help you find the right next step.", {
      requestTypeId: step.requestTypeId,
      details: `${step.detailsPrefix || ""}${String(message || "").trim().slice(0, 1500)}`,
      followupStepId: step.followupStepId,
    });
  }
  const handoff = matchingFlow(flow.id);
  return handoff ? flowState(handoff, handoff.steps[0]) : null;
}

export function getConversationFlowStep(flows, flowId, stepId) {
  const flow = normalizeConversationFlows(flows).find((candidate) => candidate.enabled && candidate.id === flowId);
  const step = flow?.steps.find((candidate) => candidate.id === stepId);
  if (!step) return null;
  return { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })) };
}
