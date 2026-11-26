export const DEFAULT_CONVERSATION_FLOWS = [
  {
    id: "welcome",
    name: "Welcome & quick actions",
    description: "A friendly hello with shortcuts to shopping, order updates, and support.",
    enabled: true,
    priority: 10,
    triggerTerms: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "হাই", "হ্যালো", "নমস্কার"],
    steps: [{
      id: "start",
      title: "Welcome",
      prompt: "Hi there! 👋 What can I help you with today?",
      choices: [
        { id: "products", label: "Find a product", action: "continueAI" },
        { id: "orders", label: "Track an order", action: "openOrderTracking", reply: "I’ll open the secure order lookup for you." },
        { id: "support", label: "Contact support", action: "openSupport", reply: "I’ll open a support request so the store team can help." },
      ],
    }],
  },
  {
    id: "product-discovery",
    name: "Product discovery",
    description: "Collects a useful product brief, then hands it to catalog-aware AI search.",
    enabled: true,
    priority: 30,
    triggerTerms: ["help me choose", "help me find a product", "recommend something", "recommend a product", "not sure what to buy"],
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
    triggerTerms: ["track my order", "track order", "order tracking", "order status", "where is my order", "order update", "cancel my order", "cancel order", "order history"],
    steps: [{
      id: "start",
      title: "Order help",
      prompt: "I can help check an order securely. For a cancellation request, the store team can confirm whether it is still possible before shipment.",
      choices: [
        { id: "track", label: "Track a specific order", action: "openOrderTracking", reply: "Enter the order number and checkout email in the secure order lookup." },
        { id: "cancel", label: "Ask about cancelling", action: "openSupport", requestTypeId: "order-delivery", details: "Customer is asking whether their order can be cancelled before shipment.", reply: "I’ll pass your cancellation question to the store team so they can check the shipment status." },
      ],
    }],
  },
  {
    id: "returns-support",
    name: "Returns & product issues",
    description: "A calm issue-triage flow for quality concerns, returns, exchanges, delivery, and damaged items.",
    enabled: true,
    priority: 100,
    triggerTerms: ["frustrated", "angry", "upset", "unhappy", "bad quality", "poor quality", "damaged", "broken", "wrong item", "return", "exchange", "refund", "complaint", "not satisfied"],
    steps: [
      {
        id: "reason",
        title: "Understand the issue",
        prompt: "I’m sorry this hasn’t gone well. What happened? Choose an option, or tell me in your own words.",
        choices: [
          { id: "quality", label: "Product quality", nextStepId: "quality" },
          { id: "return", label: "I want to return it", nextStepId: "return-details" },
          { id: "delivery", label: "Delivery or order issue", action: "openSupport", requestTypeId: "order-delivery", reply: "I’ll help the store team review the delivery issue." },
          { id: "damaged", label: "Wrong or damaged item", action: "openSupport", requestTypeId: "product-support", reply: "I’ll help the store team review the item issue." },
        ],
        routes: [
          { keywords: ["quality", "poor", "bad", "defect", "defective"], nextStepId: "quality" },
          { keywords: ["return", "refund"], nextStepId: "return-details" },
          { keywords: ["delivery", "shipping", "shipment"], nextStepId: "delivery-details" },
          { keywords: ["damaged", "broken", "wrong", "not received"], nextStepId: "item-details" },
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
      },
      {
        id: "exchange-info",
        title: "Exchange guidance",
        prompt: "I understand. We can’t arrange an exchange in this chat, so the next step is to ask the store team about returning it. Would you like me to open that request?",
        choices: [
          { id: "yes", label: "Yes, continue with a return", nextStepId: "return-details" },
          { id: "no", label: "No, I’ll decide later", nextStepId: "done" },
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
      },
      {
        id: "delivery-details",
        title: "Delivery details",
        prompt: "Please share the order number and what happened with delivery.",
        inputAction: "openSupport",
        inputReply: "Thanks for sharing that. I’ll open a support request about the delivery issue.",
        requestTypeId: "order-delivery",
        detailsPrefix: "Delivery issue: ",
      },
      {
        id: "item-details",
        title: "Item details",
        prompt: "Please tell me which product was wrong or damaged and include your order number if available.",
        inputAction: "openSupport",
        inputReply: "Thanks for sharing that. I’ll open a support request so the team can review the item issue.",
        requestTypeId: "product-support",
        detailsPrefix: "Wrong or damaged item: ",
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
  } else {
    flow = enabledFlows.map((candidate) => ({
      candidate,
      matchLength: Math.max(0, ...candidate.triggerTerms.filter((term) => includesTerm(message, term)).map((term) => normalizeForMatch(term).length)),
    })).filter((item) => item.matchLength > 0).sort((a, b) => b.candidate.priority - a.candidate.priority || b.matchLength - a.matchLength)[0]?.candidate;
    if (!flow) return null;
    step = flow.steps[0];
    const initialRoute = step.routes?.find((route) => route.keywords.some((keyword) => includesTerm(message, keyword)));
    if (initialRoute) step = flow.steps.find((candidate) => candidate.id === initialRoute.nextStepId) || step;
  }

  if (flowId && stepId) {
    const selected = step.choices?.find((choice) => choice.id === choiceId);
    if (selected?.action === "continueAI") return null;
    if (selected?.action) return {
      answer: selected.reply || step.prompt,
      action: selected.action,
      requestTypeId: selected.requestTypeId,
      details: selected.details,
      clearFlow: true,
    };
    let nextStepId = selected?.nextStepId;
    if (!nextStepId) {
      const normalizedMessage = normalizeForMatch(message);
      const routed = step.routes?.find((route) => route.keywords.some((keyword) => includesTerm(normalizedMessage, keyword)));
      nextStepId = routed?.nextStepId;
    }
    if (!nextStepId && step.inputAction === "continueAI") return null;
    if (step.inputAction) return {
      answer: step.inputReply || "Thanks for sharing that. I’ll use those details to help you find the right next step.",
      action: step.inputAction,
      requestTypeId: step.requestTypeId,
      details: `${step.detailsPrefix || ""}${String(message || "").trim().slice(0, 1500)}`,
      clearFlow: true,
    };
    if (!nextStepId) return null;
    step = flow.steps.find((candidate) => candidate.id === nextStepId);
  }

  if (!step) return null;
  return {
    answer: step.prompt,
    flow: step.choices?.length || step.inputAction ? { id: flow.id, stepId: step.id, choices: (step.choices || []).map(({ id, label }) => ({ id, label })) } : null,
  };
}
