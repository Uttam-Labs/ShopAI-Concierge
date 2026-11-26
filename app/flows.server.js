export const DEFAULT_CONVERSATION_FLOWS = [
  {
    id: "welcome",
    name: "Welcome & quick actions",
    description: "A friendly hello with shortcuts to shopping, order updates, and support.",
    enabled: true,
    priority: 10,
    triggerTerms: ["hi", "hello", "hey", "hiya", "howdy", "good morning", "good afternoon", "good evening", "what can you do", "can you help me", "I need help"],
    steps: [{
      id: "start",
      title: "Welcome",
      prompt: "Hi there! 👋 What can I help you with today?",
      choices: [
        { id: "products", label: "Find a product", nextStepId: "product-brief" },
        { id: "orders", label: "Track an order", action: "openOrderTracking", reply: "I’ll open the secure order lookup for you." },
        { id: "support", label: "Contact support", action: "openSupport", reply: "I’ll open a support request so the store team can help." },
      ],
    }, {
      id: "product-brief",
      title: "Product search",
      prompt: "Tell me what you’re looking for. Include a product type, size, budget, color, or features you prefer, and I’ll search this store’s catalog.",
      inputAction: "continueAI",
    }],
  },
  {
    id: "product-discovery",
    name: "Product discovery",
    description: "Collects a useful product brief, then hands it to catalog-aware AI search.",
    enabled: true,
    priority: 30,
    triggerTerms: ["help me choose", "help me find a product", "recommend something", "recommend a product", "not sure what to buy", "looking for a product", "show me products", "do you sell", "best product", "product for me", "shopping for"],
    steps: [{
      id: "brief",
      title: "Shopping preferences",
      prompt: "I can help narrow it down. What product are you looking for? You can include your size, budget, or must-have features.",
      inputAction: "continueAI",
    }],
  },
  {
    id: "order-updates",
    name: "Order updates",
    description: "Routes tracking and cancellation questions to the verified order lookup or support team.",
    enabled: true,
    priority: 70,
    triggerTerms: ["track my order", "track order", "order tracking", "order status", "where is my order", "order update", "cancel my order", "cancel order", "order history", "my recent orders", "check my purchase", "shipment status", "delivery status"],
    steps: [{
      id: "start",
      title: "Order help",
      prompt: "I can help with an existing order. Choose an option below. Order details are checked securely using the order number and checkout email.",
      choices: [
        { id: "track", label: "Track a specific order", action: "openOrderTracking", reply: "Enter the order number and checkout email in the secure order lookup." },
        { id: "history", label: "I need help finding an order", action: "openSupport", requestTypeId: "order-delivery", details: "Customer needs help locating an order. Please follow up by email and request the checkout email or order number.", reply: "I’ll send this to the store team. They can help locate the order using the checkout email or order number." },
        { id: "cancel", label: "Ask about cancelling", action: "openSupport", requestTypeId: "order-delivery", details: "Customer is asking whether their order can be cancelled before shipment.", reply: "I’ll pass your cancellation question to the store team so they can check the shipment status." },
      ],
      routes: [
        { keywords: ["track", "tracking", "where is my order", "status", "shipment"], choiceId: "track" },
        { keywords: ["history", "recent orders", "find an order", "past order"], choiceId: "history" },
        { keywords: ["cancel", "cancellation"], choiceId: "cancel" },
      ],
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
        prompt: "I’m sorry this hasn’t gone well. What happened? Choose an option, or tell me in your own words.",
        choices: [
          { id: "quality", label: "Product quality", nextStepId: "quality" },
          { id: "return", label: "I want to return it", nextStepId: "return-details" },
          { id: "delivery", label: "Delivery or order issue", nextStepId: "delivery-details" },
          { id: "damaged", label: "Wrong, missing, or damaged item", nextStepId: "item-details" },
        ],
        routes: [
          { keywords: ["quality", "poor", "bad", "defect", "defective"], nextStepId: "quality" },
          { keywords: ["return", "refund"], nextStepId: "return-details" },
          { keywords: ["delivery", "shipping", "shipment"], nextStepId: "delivery-details" },
          { keywords: ["damaged", "broken", "wrong", "missing", "not received"], nextStepId: "item-details" },
        ],
      },
      {
        id: "quality",
        title: "Quality concern",
        prompt: "I’m sorry the product quality wasn’t what you expected. An exchange isn’t available through this request, but I can help you ask the store team about a return. Would you like to do that?",
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
    const allowedTriggers = Array.isArray(saved.triggerTerms) ? saved.triggerTerms : defaults.triggerTerms;
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
        return {
          ...step,
          prompt: cleanText(savedStep.prompt, step.prompt, 1000),
          ...(step.inputReply ? { inputReply: cleanText(savedStep.inputReply, step.inputReply, 500) } : {}),
          ...(step.followupStepId ? { followupStepId: step.followupStepId } : {}),
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
  let flow;
  let step;

  if (flowId && stepId) {
    flow = enabledFlows.find((candidate) => candidate.id === flowId);
    step = flow?.steps.find((candidate) => candidate.id === stepId);
    if (!flow || !step) return null;
    if (!choiceId) {
      const handoff = enabledFlows.map((candidate) => ({
        candidate,
        matchLength: Math.max(0, ...candidate.triggerTerms.filter((term) => includesTerm(message, term)).map((term) => normalizeForMatch(term).length)),
      })).filter((item) => item.matchLength > 0 && item.candidate.id !== flowId).sort((a, b) => b.matchLength - a.matchLength || b.candidate.priority - a.candidate.priority)[0]?.candidate;
      if (handoff) {
        flow = handoff;
        step = flow.steps[0];
        const route = step.routes?.find((entry) => entry.keywords.some((keyword) => includesTerm(message, keyword)));
        if (route) step = flow.steps.find((candidate) => candidate.id === route.nextStepId) || step;
        return { answer: step.prompt, flow: step.choices?.length || step.inputAction ? { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })) } : null };
      }
    }
  } else {
    flow = enabledFlows.map((candidate) => ({
      candidate,
      matchLength: Math.max(0, ...candidate.triggerTerms.filter((term) => includesTerm(message, term)).map((term) => normalizeForMatch(term).length)),
    })).filter((item) => item.matchLength > 0).sort((a, b) => b.candidate.priority - a.candidate.priority || b.matchLength - a.matchLength)[0]?.candidate;
    if (!flow) {
      flow = enabledFlows.map((candidate) => ({
        candidate,
        matchLength: Math.max(0, ...candidate.triggerTerms.filter((term) => includesTerm(message, term)).map((term) => normalizeForMatch(term).length)),
      })).filter((item) => item.matchLength > 0 && item.candidate.id !== flowId).sort((a, b) => b.matchLength - a.matchLength || b.candidate.priority - a.candidate.priority)[0]?.candidate;
      if (!flow) return null;
    }
    step = flow.steps[0];
    const initialRoute = step.routes?.find((route) => route.keywords.some((keyword) => includesTerm(message, keyword)));
    if (initialRoute?.choiceId) {
      const choice = step.choices?.find((candidate) => candidate.id === initialRoute.choiceId);
      if (choice?.action) return { answer: choice.reply || step.prompt, action: choice.action, requestTypeId: choice.requestTypeId, details: choice.details, followupStepId: choice.followupStepId || step.followupStepId, flowId: flow.id, clearFlow: true };
      if (choice?.nextStepId) step = flow.steps.find((candidate) => candidate.id === choice.nextStepId) || step;
    } else if (initialRoute) step = flow.steps.find((candidate) => candidate.id === initialRoute.nextStepId) || step;
  }

  if (flowId && stepId) {
    const explicitChoice = step.choices?.find((choice) => choice.id === choiceId);
    const selectedRoute = !explicitChoice ? step.routes?.find((route) => route.keywords.some((keyword) => includesTerm(message, keyword))) : null;
    const selected = explicitChoice || (selectedRoute?.choiceId ? step.choices?.find((choice) => choice.id === selectedRoute.choiceId) : null);
    if (selected?.action === "continueAI") return null;
    if (selected?.action) return {
      answer: selected.reply || step.prompt,
      action: selected.action,
      requestTypeId: selected.requestTypeId,
      details: selected.details,
      followupStepId: selected.followupStepId || step.followupStepId,
      flowId: flow.id,
      clearFlow: true,
    };
    let nextStepId = selected?.nextStepId;
    if (!nextStepId) {
      const normalizedMessage = normalizeForMatch(message);
      const routed = selectedRoute || step.routes?.find((route) => route.keywords.some((keyword) => includesTerm(normalizedMessage, keyword)));
      nextStepId = routed?.nextStepId;
    }
    if (!nextStepId && step.inputAction === "continueAI") return null;
    if (step.inputAction) return {
      answer: step.inputReply || "Thanks for sharing that. I’ll use those details to help you find the right next step.",
      action: step.inputAction,
      requestTypeId: step.requestTypeId,
      details: `${step.detailsPrefix || ""}${String(message || "").trim().slice(0, 1500)}`,
      followupStepId: step.followupStepId,
      flowId: flow.id,
      clearFlow: true,
    };
    if (!nextStepId) {
      const handoff = enabledFlows.map((candidate) => ({
        candidate,
        matchLength: Math.max(0, ...candidate.triggerTerms.filter((term) => includesTerm(message, term)).map((term) => normalizeForMatch(term).length)),
      })).filter((item) => item.matchLength > 0 && item.candidate.id !== flow.id).sort((a, b) => b.matchLength - a.matchLength || b.candidate.priority - a.candidate.priority)[0]?.candidate;
      if (!handoff) return null;
      flow = handoff;
      step = flow.steps[0];
      const route = step.routes?.find((entry) => entry.keywords.some((keyword) => includesTerm(message, keyword)));
      if (route) step = flow.steps.find((candidate) => candidate.id === route.nextStepId) || step;
      return { answer: step.prompt, flow: step.choices?.length || step.inputAction ? { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })) } : null };
    }
    step = flow.steps.find((candidate) => candidate.id === nextStepId);
  }

  if (!step) return null;
  return {
    answer: step.prompt,
    flow: step.choices?.length || step.inputAction ? { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })) } : null,
  };
}

export function getConversationFlowStep(flows, flowId, stepId) {
  const flow = normalizeConversationFlows(flows).find((candidate) => candidate.enabled && candidate.id === flowId);
  const step = flow?.steps.find((candidate) => candidate.id === stepId);
  if (!step) return null;
  return { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })) };
}
