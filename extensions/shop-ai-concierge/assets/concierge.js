(() => {
  const defaultSupportTypes = [
    { id: "order-delivery", label: "Order or delivery", question: "What can we help you with about your order?", answer: "If you have an order number, please keep it ready for the support team.", active: true },
    { id: "product-support", label: "Product support", question: "What product do you need help with?", answer: "Our team will review your product question and follow up by email.", active: true },
    { id: "returns-refunds", label: "Returns or refunds", question: "How can we help with your return or refund?", answer: "Our team will check the store’s return policy and follow up by email.", active: true },
  ];
  document.querySelectorAll(".sac-root:not([data-mounted])").forEach((root) => {
    root.dataset.mounted = "true";
    const accent = root.dataset.accent || "#f97316";
    const background = root.dataset.background || "#ffffff";
    const textColor = root.dataset.text || "#171717";
    const fontSize = `${Number(root.dataset.fontSize) || 14}px`;
    const width = `${Number(root.dataset.width) || 380}px`;
    const shop = window.Shopify?.shop || location.hostname;
    const apiEndpoint = `${window.Shopify?.routes?.root || "/"}apps/shopai-concierge`;
    const storageKey = `sac-chat:${shop}`;
    let storedChat = readStoredChat(storageKey);
    const sessionId = storedChat?.sessionId || crypto.randomUUID();
    let identity = storedChat?.identity || { name: "", email: "" };
    let activeFlow = storedChat?.activeFlow || null;
    let chatHistory = Array.isArray(storedChat?.messages)
      ? storedChat.messages.filter((item) => !(item?.role === "assistant" && /Unexpected token|not valid JSON|returned a web page instead of chat data|apiEndpoint is not defined|ReferenceError/i.test(String(item.content || "")))).slice(-40)
      : [];
    const panel = document.createElement("section");
    panel.className = "sac-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", "ShopAI customer support chat");
    setThemeVariables(panel, { accent, background, textColor, fontSize, width });
    const supportButtonLabel = root.dataset.humanHelpLabel === "Human help" ? "Contact support" : (root.dataset.humanHelpLabel || "Contact support");
    const supportTitle = root.dataset.supportTitle === "Would you like a person to help?" ? "Submit a support request" : (root.dataset.supportTitle || "Submit a support request");
    const supportDetailsLabel = root.dataset.supportDetailsLabel === "Tell us about the issue" ? "Tell us more (optional)" : (root.dataset.supportDetailsLabel || "Tell us more (optional)");
    panel.innerHTML = `<div class="sac-head"><div class="sac-brand"><span class="sac-brand-mark">✦</span><div class="sac-brand-copy"><strong>${escapeHtml(root.dataset.title || "How can we help?")}</strong><span class="sac-live">Here to help</span></div></div><button class="sac-close" type="button" aria-label="Close chat">×</button></div><div class="sac-welcome"><span>Product advice</span><i></i><span>Order updates</span><i></i><span>Store support</span><button type="button" class="sac-help-button" aria-label="Contact store support"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8 8 0 0 1-3.5-.8L4 20l1.2-3.7A7.4 7.4 0 0 1 4 12.5 7.5 7.5 0 0 1 12 5a7.5 7.5 0 0 1 8 6.5Z"/><path d="M12 9v4m0 3h.01"/></svg><span>${escapeHtml(supportButtonLabel)}</span></button></div><div class="sac-messages" aria-live="polite" aria-relevant="additions text"><div class="sac-message-row sac-assistant-row sac-initial-greeting"><span class="sac-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4.5" y="8" width="15" height="11" rx="4"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6M3 12v3M21 12v3"/></svg></span><div class="sac-message-content"><div class="sac-msg sac-greeting">Hi there! 👋 Tell me what you’re shopping for, ask about our policies, or track an order.</div><time class="sac-message-time" data-time="${Date.now()}">just now</time></div></div><div class="sac-faqs" hidden><div class="sac-faq-heading"><span>POPULAR QUESTIONS</span><small>Choose a question</small></div><div class="sac-faq-list"></div></div></div><div class="sac-form-wrap"><form class="sac-form"><textarea class="sac-input" rows="1" maxlength="1000" autocomplete="off" placeholder="Ask us anything…" aria-label="Your message"></textarea><button class="sac-send" type="submit" aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg></button></form><div class="sac-footer">Powered by <span>ShopAI Concierge</span></div></div><div class="sac-support-backdrop" hidden><section class="sac-support-card" role="dialog" aria-modal="true" aria-labelledby="sac-support-title"><button type="button" class="sac-support-close" aria-label="Close support request">×</button><span class="sac-support-icon">✦</span><p class="sac-support-kicker">CUSTOMER SUPPORT</p><h3 id="sac-support-title">${escapeHtml(supportTitle)}</h3><p class="sac-support-copy">${escapeHtml(root.dataset.supportDescription || "Tell us what you need help with. Our team will follow up by email.")}</p><form class="sac-support-form"><label>${escapeHtml(root.dataset.supportNameLabel || "Your name")}<input name="customerName" autocomplete="name" maxlength="120" placeholder="${escapeHtml(root.dataset.supportNamePlaceholder || "Name")}" required></label><label>${escapeHtml(root.dataset.supportEmailLabel || "Email for follow-up")}<input name="customerEmail" type="email" autocomplete="email" maxlength="254" placeholder="${escapeHtml(root.dataset.supportEmailPlaceholder || "you@example.com")}" required></label><label>${escapeHtml(root.dataset.supportIssueTypeLabel || "Select a request type")}<select name="requestTypeId" class="sac-support-select" required><option value="" selected disabled>${escapeHtml(root.dataset.supportTypePlaceholder || "Choose a support topic")}</option><option value="other">${escapeHtml(root.dataset.supportOtherOption || "Other")}</option></select></label><div class="sac-support-guidance" hidden><strong class="sac-support-question"></strong><p class="sac-support-answer"></p></div><label class="sac-support-other-field">${escapeHtml(supportDetailsLabel)}<textarea name="requestDetails" rows="3" maxlength="2000" placeholder="${escapeHtml(root.dataset.supportDetailsPlaceholder || "Describe what you need help with…")}"></textarea></label><div class="sac-support-notice" aria-live="polite"></div><footer><button type="button" class="sac-support-cancel">${escapeHtml(root.dataset.supportCancelLabel || "Cancel")}</button><button type="submit" class="sac-support-submit">${escapeHtml(root.dataset.supportSubmitLabel || "Create support request")}</button></footer></form></section></div>`;
    const welcome = panel.querySelector(".sac-welcome");
    Array.from(welcome.childNodes).forEach((node) => {
      if (!(node.nodeType === Node.ELEMENT_NODE && node.classList.contains("sac-help-button"))) node.remove();
    });
    panel.insertAdjacentHTML("beforeend", `<div class="sac-order-backdrop" hidden><section class="sac-order-card" role="dialog" aria-modal="true" aria-labelledby="sac-order-title"><button type="button" class="sac-order-close" aria-label="Close order tracking">×</button><span class="sac-order-icon" aria-hidden="true">↗</span><p class="sac-order-kicker">ORDER UPDATES</p><h3 id="sac-order-title">Track your order</h3><p class="sac-order-copy">Enter your order number and the email used at checkout to see its latest status and total.</p><form class="sac-order-form"><label>Order number<input name="orderNumber" autocomplete="off" maxlength="31" placeholder="e.g. #1001 or 1001" required></label><label class="sac-order-email-label">Email used at checkout<input name="customerEmail" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com"></label><div class="sac-order-notice" aria-live="polite"></div><footer><button type="button" class="sac-order-cancel">Cancel</button><button type="submit" class="sac-order-submit">Find my order</button></footer></form><section class="sac-order-result" hidden><div class="sac-order-result-title"></div><p class="sac-order-result-copy"></p><div class="sac-order-details" hidden></div><button type="button" class="sac-order-view">View order details</button></section></section></div>`);

    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "sac-launch";
    launcher.setAttribute("aria-label", "Open chat");
    launcher.setAttribute("aria-expanded", "false");
    setThemeVariables(launcher, { accent, background, textColor, fontSize, width });
    const icon = root.dataset.icon || "chat";
    launcher.innerHTML = icon === "help" ? "<span class=\"sac-help-icon\">?</span>" : icon === "spark" ? "<span class=\"sac-spark-icon\">✦</span>" : "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z\"/></svg>";
    document.body.append(panel, launcher);
    const confirmLeavingOpenChat = (event) => {
      if (!panel.classList.contains("is-open")) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmLeavingOpenChat);

    const messages = panel.querySelector(".sac-messages");
    const form = panel.querySelector(".sac-form");
    const input = panel.querySelector(".sac-input");
    const faqSection = panel.querySelector(".sac-faqs");
    const faqList = panel.querySelector(".sac-faq-list");
    const enableOrderLookup = root.dataset.enableOrderLookup !== "false";
    const orderButton = document.createElement("button");
    orderButton.type = "button";
    orderButton.className = "sac-order-button";
    // Show the tracking entry point immediately from the theme setting. Waiting
    // for the async app-proxy config caused it to appear only after a reflow/scroll.
    orderButton.hidden = !enableOrderLookup;
    orderButton.innerHTML = '<span aria-hidden="true">↗</span><span>Track an order</span>';
    const welcomeActions = document.createElement("div");
    welcomeActions.className = "sac-welcome-actions";
    welcomeActions.append(orderButton, panel.querySelector(".sac-help-button"));
    panel.querySelector(".sac-welcome").append(welcomeActions);
    const orderBackdrop = panel.querySelector(".sac-order-backdrop");
    const orderForm = panel.querySelector(".sac-order-form");
    const orderNotice = panel.querySelector(".sac-order-notice");
    const orderEmail = orderForm.elements.customerEmail;
    const orderEmailLabel = orderEmail.closest("label");
    const orderCopy = panel.querySelector(".sac-order-copy");
    let orderEmailRequired = true;
    orderEmail.required = true;
    const setOrderEmailRequirement = (required) => {
      orderEmailRequired = required;
      orderEmail.required = required;
      orderEmailLabel.firstChild.textContent = required ? "Email used at checkout" : "Email used at checkout (optional)";
      orderEmail.placeholder = required ? "you@example.com" : "Add it to verify the order";
      orderCopy.textContent = required
        ? "Enter your order number and the email used at checkout to see its latest status and total."
        : "Enter your order number to see its latest status and total. Adding the checkout email helps verify the order.";
    };
    const orderResult = panel.querySelector(".sac-order-result");
    const orderResultTitle = panel.querySelector(".sac-order-result-title");
    const orderResultCopy = panel.querySelector(".sac-order-result-copy");
    const orderDetails = panel.querySelector(".sac-order-details");
    const initialGreeting = panel.querySelector(".sac-initial-greeting");
    const supportBackdrop = panel.querySelector(".sac-support-backdrop");
    const supportForm = panel.querySelector(".sac-support-form");
    const supportIssueType = supportForm.elements.requestTypeId;
    const supportIssueDetails = supportForm.elements.requestDetails;
    const supportGuidance = panel.querySelector(".sac-support-guidance");
    const supportQuestion = panel.querySelector(".sac-support-question");
    const supportAnswer = panel.querySelector(".sac-support-answer");
    let supportTypes = defaultSupportTypes;
    const populateSupportTypes = (types) => {
      const currentValue = supportIssueType.value;
      supportTypes = types;
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.textContent = root.dataset.supportTypePlaceholder || "Choose a support topic";
      const other = document.createElement("option");
      other.value = "other";
      other.textContent = root.dataset.supportOtherOption || "Other";
      supportIssueType.replaceChildren(placeholder, ...supportTypes.map((item) => {
        const option = document.createElement("option");
        option.value = String(item.id);
        option.textContent = String(item.label);
        return option;
      }), other);
      supportIssueType.value = currentValue === "other" || supportTypes.some((item) => item.id === currentValue) ? currentValue : "";
    };
    populateSupportTypes(defaultSupportTypes);
    const enableFaqs = root.dataset.enableFaq !== "false";
    const enableRecommendations = root.dataset.enableRecommendations !== "false";
    const persistChat = () => {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ sessionId, identity, activeFlow, messages: chatHistory.slice(-40) })); } catch { /* Session storage can be disabled by the browser. */ }
    };
    const openOrderTracking = () => {
      orderNotice.textContent = "";
      orderResult.hidden = true;
      orderForm.elements.customerEmail.value = identity?.email || "";
      orderBackdrop.hidden = false;
      orderForm.elements.orderNumber.focus();
    };
    const addOrderTrackingAction = (row) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sac-order-chat-view sac-order-chat-link";
      button.textContent = "Click here to check your order";
      button.addEventListener("click", openOrderTracking);
      const content = row.querySelector(".sac-message-content");
      content.insertBefore(button, content.querySelector(".sac-message-time"));
    };
    const restoredOrderRows = [];
    if (chatHistory.length) {
      initialGreeting.remove();
      chatHistory.forEach((item) => {
        const restored = addMessage(messages, item.content, item.role === "user" ? "user" : "assistant", item.createdAt);
        if (item.ticketReference && item.role === "assistant") addTicketReference(restored.row, item.ticketReference);
        if (item.openOrderTracking && item.role === "assistant") addOrderTrackingAction(restored.row);
        if (item.flow && item.role === "assistant" && activeFlow?.id === item.flow.id && activeFlow?.stepId === item.flow.stepId) renderFlowChoices(restored.row, item.flow, sendMessage);
        if (item.order && item.role === "assistant") restoredOrderRows.push({ row: restored.row, order: item.order, answer: item.content });
        if (item.products?.length && item.role === "assistant") renderProducts(messages, item.products, { persist: false, purchaseIntent: item.purchaseIntent === true });
      });
      messages.append(faqSection);
    } else {
      const greeting = initialGreeting.querySelector(".sac-greeting").textContent;
      chatHistory.push({ role: "assistant", content: greeting, createdAt: Date.now() });
      persistChat();
    }
    const resizeComposer = () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
      input.classList.toggle("is-scrollable", input.scrollHeight > 128);
    };
    input.addEventListener("input", resizeComposer);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    setInterval(() => panel.querySelectorAll(".sac-message-time[data-time]").forEach((time) => { time.textContent = relativeTime(Number(time.dataset.time)); }), 15000);

    {
      fetch(apiEndpoint, { headers: { accept: "application/json" }, cache: "no-store" })
        .then((response) => readApiJson(response, "chat settings"))
        .then((config) => {
          if (!config) return;
          const greeting = panel.querySelector(".sac-greeting");
          if (config.greeting && greeting) {
            greeting.textContent = config.greeting;
            if (!chatHistory.some((item) => item.role === "user") && chatHistory[0]?.role === "assistant") {
              chatHistory[0].content = config.greeting;
              persistChat();
            }
          }
          if (config.humanHandoff === false) panel.querySelector(".sac-help-button").hidden = true;
          orderButton.hidden = !enableOrderLookup || config.orderLookup === false;
          setOrderEmailRequirement(config.orderEmailRequired !== false);
          if (enableFaqs && Array.isArray(config.faqs) && config.faqs.length) renderFaqs(config.faqs, faqSection, faqList, sendMessage);
          const configuredOptions = Array.isArray(config.ticketOptions) ? config.ticketOptions : [];
          const activeOptions = configuredOptions.filter((item) => item && item.active !== false && item.id && item.label).slice(0, 20);
          populateSupportTypes(configuredOptions.length ? activeOptions : defaultSupportTypes);
        })
        .catch((error) => console.error("ShopAI settings request failed", error));
    }

    launcher.addEventListener("click", () => {
      const open = panel.classList.toggle("is-open");
      launcher.setAttribute("aria-expanded", String(open));
      if (open) input.focus();
    });
    panel.querySelector(".sac-close").addEventListener("click", () => {
      panel.classList.remove("is-open");
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    });
    const closeOrderLookup = () => { orderBackdrop.hidden = true; };
    const setOrderResult = (order, answer) => {
      orderResult.hidden = false;
      orderResultTitle.textContent = `${order.name} · ${String(order.fulfillmentStatus || "Status unavailable").replaceAll("_", " ")}`;
      orderResultCopy.textContent = answer;
      orderDetails.replaceChildren();
      const lines = [
        order.createdAt ? `Placed ${new Date(order.createdAt).toLocaleDateString()}` : "",
        order.financialStatus ? `Payment: ${String(order.financialStatus).replaceAll("_", " ")}` : "",
        order.total ? `Total: ${new Intl.NumberFormat(document.documentElement.lang || "en", { style: "currency", currency: order.currency || window.Shopify?.currency?.active || "USD" }).format(Number(order.total))}` : "",
      ].filter(Boolean);
      lines.forEach((line) => { const detail = document.createElement("p"); detail.textContent = line; orderDetails.append(detail); });
      if (order.items?.length) {
        const title = document.createElement("strong"); title.textContent = "Items"; orderDetails.append(title);
        const list = document.createElement("ul");
        order.items.forEach((item) => { const entry = document.createElement("li"); entry.textContent = `${item.title} × ${item.quantity}`; list.append(entry); });
        orderDetails.append(list);
      }
      (order.tracking || []).forEach((tracking) => {
        const row = document.createElement("p");
        const label = `${tracking.company || "Carrier"}: ${tracking.number}`;
        if (tracking.url && /^https:\/\//i.test(tracking.url)) { const link = document.createElement("a"); link.href = tracking.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = label; row.append(link); }
        else row.textContent = label;
        orderDetails.append(row);
      });
      if (order.statusPageUrl && /^https:\/\//i.test(order.statusPageUrl)) { const link = document.createElement("a"); link.className = "sac-order-status-link"; link.href = order.statusPageUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Open Shopify order status"; orderDetails.append(link); }
      orderDetails.hidden = true;
      panel.querySelector(".sac-order-view").textContent = "View order details";
    };
    const addOrderDetailsAction = (row, order, answer) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sac-order-chat-view";
      button.textContent = "View order details";
      button.addEventListener("click", () => {
        setOrderResult(order, answer);
        orderBackdrop.hidden = false;
        orderDetails.hidden = false;
        panel.querySelector(".sac-order-view").textContent = "Hide order details";
      });
      const content = row.querySelector(".sac-message-content");
      content.insertBefore(button, content.querySelector(".sac-message-time"));
    };
    restoredOrderRows.forEach(({ row, order, answer }) => addOrderDetailsAction(row, order, answer));
    orderButton.addEventListener("click", openOrderTracking);
    panel.querySelector(".sac-order-close").addEventListener("click", closeOrderLookup);
    panel.querySelector(".sac-order-cancel").addEventListener("click", closeOrderLookup);
    orderBackdrop.addEventListener("click", (event) => { if (event.target === orderBackdrop) closeOrderLookup(); });
    panel.querySelector(".sac-order-view").addEventListener("click", () => {
      orderDetails.hidden = !orderDetails.hidden;
      panel.querySelector(".sac-order-view").textContent = orderDetails.hidden ? "View order details" : "Hide order details";
    });
    orderForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = panel.querySelector(".sac-order-submit");
      const orderNumberValue = String(new FormData(orderForm).get("orderNumber") || "").trim().replace(/^#/, "");
      const emailValue = String(new FormData(orderForm).get("customerEmail") || "").trim().toLowerCase();
      if (!/^[A-Za-z0-9-]{1,30}$/.test(orderNumberValue)) { orderNotice.textContent = "Enter a valid order number, such as 1001."; return; }
      if ((orderEmailRequired && !emailValue) || (emailValue && (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(emailValue) || emailValue.includes("..")))) { orderNotice.textContent = orderEmailRequired ? "Enter the valid email address used at checkout." : "That email address doesn’t look valid. Check it and try again."; orderEmail.focus(); return; }
      submit.disabled = true;
      submit.textContent = "Checking order…";
      orderNotice.textContent = "";
      orderResult.hidden = true;
      const customerText = `Track order #${orderNumberValue}`;
      closeOrderLookup();
      addMessage(messages, customerText, "user");
      chatHistory.push({ role: "user", content: customerText, createdAt: Date.now() });
      persistChat();
      const pending = addMessage(messages, "", "assistant pending");
      pending.bubble.innerHTML = '<span class="sac-typing" aria-hidden="true"><i></i><i></i><i></i></span><span class="sac-sr-only">Checking your order</span>';
      try {
        const response = await postProxyData(apiEndpoint, { message: customerText, shop, sessionId, customerName: identity?.name || "", customerEmail: emailValue, orderNumber: orderNumberValue, orderLookupRequest: true });
        const data = await readApiJson(response, "order lookup");
        if (!response.ok) throw new Error(data.error || "We couldn’t find that order. Check the details and try again.");
        pending.row.remove();
        const reply = addMessage(messages, data.answer || "Your order status is ready.", "assistant");
        addOrderDetailsAction(reply.row, data.order, data.answer);
        chatHistory.push({ role: "assistant", content: data.answer || "Your order status is ready.", createdAt: Date.now(), order: data.order });
        setOrderResult(data.order, data.answer);
        persistChat();
      } catch (error) {
        pending.row.remove();
        const errorMessage = error instanceof ReferenceError || error instanceof TypeError
          ? "We couldn’t connect to order tracking just now. Please try again in a moment."
          : (error.message || "Order tracking is temporarily unavailable. Please try again.");
        orderNotice.textContent = errorMessage;
        const reply = addMessage(messages, errorMessage, "assistant");
        chatHistory.push({ role: "assistant", content: errorMessage, createdAt: Date.now() });
        reply.bubble.classList.add("error");
        persistChat();
      } finally {
        submit.disabled = false;
        submit.textContent = "Find my order";
        messages.scrollTop = messages.scrollHeight;
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage(input.value);
    });

    async function sendMessage(rawMessage, options = {}) {
      const message = String(rawMessage || "").trim();
      const faqId = typeof options.faqId === "string" ? options.faqId : "";
      if (!message || form.dataset.sending === "true") return;
      const previousAssistantTurn = chatHistory[chatHistory.length - 1];
      if (!options.flow && /^(yes|yes please|sure|go ahead|please do|that one)$/i.test(message) && previousAssistantTurn?.role === "assistant" && previousAssistantTurn.purchaseIntent) {
        const purchaseCards = [...messages.querySelectorAll('.sac-products[data-purchase-intent="true"] .sac-card')];
        const exactCard = purchaseCards.find((card) => card.querySelector(".sac-exact-match-badge"));
        const pendingPurchase = exactCard?.querySelector("button:not(:disabled)") || (purchaseCards.length === 1 ? purchaseCards[0].querySelector("button:not(:disabled)") : null);
        if (pendingPurchase) {
          addMessage(messages, message, "user");
          chatHistory.push({ role: "user", content: message, createdAt: Date.now() });
          persistChat();
          addMessage(messages, "Great, I’ll add that item to your cart and take you to checkout.", "assistant");
          pendingPurchase.click();
          input.value = "";
          resizeComposer();
          return;
        }
      }
      const flowState = options.flow || (faqId ? null : activeFlow);
      activeFlow = null;
      chatHistory.forEach((item) => { delete item.flow; });
      panel.querySelectorAll(".sac-flow-choices").forEach((choices) => choices.remove());
      const emailFromMessage = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
      if (emailFromMessage && !identity?.email) identity = { ...(identity || {}), name: identity?.name || "Anonymous shopper", email: emailFromMessage.toLowerCase() };
      addMessage(messages, message, "user");
      input.value = "";
      resizeComposer();
      form.dataset.sending = "true";
      panel.querySelector(".sac-send").disabled = true;
      chatHistory.push({ role: "user", content: message, createdAt: Date.now() });
      persistChat();
      const pending = addMessage(messages, "", "assistant pending");
      pending.bubble.setAttribute("aria-label", "ShopAI is replying");
      pending.bubble.innerHTML = '<span class="sac-typing" aria-hidden="true"><i></i><i></i><i></i></span><span class="sac-sr-only">ShopAI is replying</span>';
      try {
        const response = await postProxyData(apiEndpoint, { message, shop, sessionId, customerName: identity?.name || "", customerEmail: identity?.email || "", pageUrl: location.href, ...(faqId ? { faqId } : {}), ...(flowState ? { flowId: flowState.id, flowStepId: flowState.stepId, ...(options.flow?.choiceId ? { flowChoiceId: options.flow.choiceId } : {}) } : {}) });
        const data = await readApiJson(response, "chat reply");
        if (!response.ok) throw new Error(data.error || "I couldn’t complete that request. Please try again.");
        pending.row.remove();
        const answer = data.answer || "I’m sorry, I couldn’t find an answer to that just yet.";
        const reply = addMessage(messages, answer, "assistant");
        if (data.openOrderTracking) addOrderTrackingAction(reply.row);
        if (data.openOrderTrackingNow) openOrderTracking();
        if (data.order) addOrderDetailsAction(reply.row, data.order, answer);
        if (data.openSupport) openSupportRequest(data.openSupport);
        activeFlow = data.flow || null;
        if (activeFlow) renderFlowChoices(reply.row, activeFlow, sendMessage);
        const recommendedProducts = enableRecommendations && Array.isArray(data.products) ? data.products.slice(0, 5) : [];
        const savedProducts = recommendedProducts.slice(0, 5);
        chatHistory.push({ role: "assistant", content: answer, createdAt: Date.now(), ...(activeFlow ? { flow: activeFlow } : {}), ...(data.openOrderTracking ? { openOrderTracking: true } : {}), ...(data.order ? { order: data.order } : {}), ...(data.purchaseIntent ? { purchaseIntent: true } : {}), ...(savedProducts.length ? { products: savedProducts } : {}) });
        persistChat();
        if (recommendedProducts.length) renderProducts(messages, recommendedProducts, { purchaseIntent: data.purchaseIntent === true });
      } catch (error) {
        pending.bubble.classList.remove("pending", "error");
        const isIdentityQuestion = /\b(who are you|what are you|what can you do|how can you help)\b/i.test(message);
        const isProductQuestion = /\b(product|products|item|buy|shop|recommend|price|size|available|in stock|best)\b/i.test(message);
        pending.bubble.textContent = isIdentityQuestion
          ? "I’m ShopAI Concierge, your store’s virtual shopping assistant. I can help find products, answer store questions, check an order, or help you contact the store team. I can’t reach the store service right now, so please try again shortly."
          : isProductQuestion
            ? "I’d be happy to help find the right product. I can’t access the store’s live catalog right now, so I don’t want to guess. Please try again shortly, or use the order and support options above."
            : "I’m sorry, I can’t reach the store service right now. You can use the order or support options above, or try your question again in a moment.";
        chatHistory.push({ role: "assistant", content: pending.bubble.textContent, createdAt: Date.now() });
        persistChat();
      } finally {
        form.dataset.sending = "false";
        panel.querySelector(".sac-send").disabled = false;
        messages.scrollTop = messages.scrollHeight;
      }
    }

    const closeSupport = () => { supportBackdrop.hidden = true; };
    let supportFollowup = null;
    const openSupportRequest = (prefill = {}) => {
      supportFollowup = prefill.followup && typeof prefill.followup === "object" ? prefill.followup : null;
      const supportValues = supportForm.elements;
      supportValues.customerName.value = identity?.name === "Anonymous shopper" ? "" : identity?.name || "";
      supportValues.customerEmail.value = identity?.email || "";
      const requestTypeAvailable = supportTypes.some((item) => item.id === prefill.requestTypeId && item.active !== false);
      supportIssueType.value = requestTypeAvailable ? prefill.requestTypeId : (prefill.requestTypeId ? "other" : "");
      const selectedType = supportTypes.find((item) => item.id === supportIssueType.value);
      supportGuidance.hidden = !selectedType;
      supportQuestion.textContent = selectedType?.question || "";
      supportAnswer.textContent = selectedType?.answer || "";
      supportIssueDetails.required = false;
      supportIssueDetails.value = prefill.details || (!requestTypeAvailable && prefill.requestTypeId ? `Suggested request type: ${prefill.requestTypeId}` : "");
      panel.querySelector(".sac-support-notice").textContent = identity?.email
        ? (root.dataset.supportSavedEmailNotice || "Saved for this chat: {email}. Confirm it or enter a different email.").replace("{email}", identity.email)
        : (root.dataset.supportContactNotice || "Please add a name and email so the team can reply to your request.");
      supportBackdrop.hidden = false;
      (identity?.email ? supportValues.customerName : supportValues.customerEmail).focus();
    };
    panel.querySelector(".sac-help-button").addEventListener("click", () => openSupportRequest());
    supportIssueType.addEventListener("change", () => {
      const selected = supportTypes.find((item) => item.id === supportIssueType.value);
      supportGuidance.hidden = !selected;
      supportQuestion.textContent = selected?.question || "";
      supportAnswer.textContent = selected?.answer || "";
    });
    panel.querySelector(".sac-support-close").addEventListener("click", closeSupport);
    panel.querySelector(".sac-support-cancel").addEventListener("click", closeSupport);
    supportBackdrop.addEventListener("click", (event) => { if (event.target === supportBackdrop) closeSupport(); });
    supportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = supportForm.querySelector(".sac-support-submit");
      const notice = panel.querySelector(".sac-support-notice");
      const values = new FormData(supportForm);
      const name = String(values.get("customerName") || "").trim();
      const email = String(values.get("customerEmail") || "").trim().toLowerCase();
      const requestTypeId = String(values.get("requestTypeId") || "");
      const requestDetails = String(values.get("requestDetails") || "").trim();
      const emailInput = supportForm.elements.customerEmail;
      if (!name) { notice.textContent = "Please enter your name so the store team knows who to reply to."; supportForm.elements.customerName.focus(); return; }
      if (!email) { notice.textContent = "Please enter an email address so the team can follow up with you."; emailInput.focus(); return; }
      if (email.length > 254 || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email) || email.includes("..")) { notice.textContent = "That email address doesn’t look quite right. Please check it and try again (for example, name@example.com)."; emailInput.focus(); return; }
      if (!requestTypeId) { notice.textContent = "Choose a support topic before creating your request."; supportIssueType.focus(); return; }
      submit.disabled = true;
      submit.textContent = root.dataset.supportSubmittingLabel || "Creating ticket…";
      notice.textContent = "";
      const selectedType = supportTypes.find((item) => item.id === requestTypeId);
      const ticketMessage = `Support request: ${selectedType?.label || (requestTypeId === "other" ? "Other" : "Customer support")}`;
      closeSupport();
      addMessage(messages, ticketMessage, "user");
      chatHistory.push({ role: "user", content: ticketMessage, createdAt: Date.now() });
      persistChat();
      const pending = addMessage(messages, "", "assistant pending");
      pending.bubble.setAttribute("aria-label", "Creating your support ticket");
      pending.bubble.innerHTML = '<span class="sac-typing" aria-hidden="true"><i></i><i></i><i></i></span><span class="sac-sr-only">Creating your support ticket</span>';
      try {
        const supportContext = chatHistory.slice(0, -1).slice(-12).map(({ role, content }) => ({ role, content }));
        const response = await postProxyData(apiEndpoint, { message: ticketMessage, shop, sessionId, customerName: name, customerEmail: email, supportRequest: true, requestTypeId, requestDetails, supportContext, ...(supportFollowup ? { supportFollowup } : {}), supportSuccessMessage: root.dataset.supportSuccessMessage || "" });
        const data = await readApiJson(response, "support ticket");
        if (!response.ok) throw new Error(data.error || "We couldn’t create your ticket. Please try again.");
        identity = { name, email };
        const ticketReference = String(data.ticket?.reference || "").trim();
        if (!ticketReference) throw new Error("We couldn’t confirm that your ticket was saved. Please try again. If this keeps happening, contact the store team directly.");
        const confirmedReply = String(data.answer || "Your support request has been received. Our team will follow up with you by email soon.");
        pending.row.remove();
        const reply = addMessage(messages, confirmedReply, "assistant");
        addTicketReference(reply.row, ticketReference);
        activeFlow = data.flow || null;
        if (activeFlow) renderFlowChoices(reply.row, activeFlow, sendMessage);
        chatHistory.push({ role: "assistant", content: confirmedReply, createdAt: Date.now(), ticketReference, ...(activeFlow ? { flow: activeFlow } : {}) });
        persistChat();
        supportFollowup = null;
      } catch (error) {
        const errorMessage = error.message || "We couldn’t create your ticket. Please try again.";
        pending.row.remove();
        const reply = addMessage(messages, errorMessage, "assistant");
        reply.bubble.classList.add("error");
        chatHistory.push({ role: "assistant", content: errorMessage, createdAt: Date.now() });
        persistChat();
      } finally {
        submit.disabled = false;
        submit.textContent = root.dataset.supportSubmitLabel || "Create support ticket";
      }
    });
  });

  function setThemeVariables(element, values) {
    element.style.setProperty("--sac-accent", values.accent);
    element.style.setProperty("--sac-bg", values.background);
    element.style.setProperty("--sac-text", values.textColor);
    element.style.setProperty("--sac-width", values.width);
    element.style.setProperty("--sac-font", values.fontSize);
  }
  async function readApiJson(response, purpose) {
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); }
    catch {
      console.error(`ShopAI ${purpose} endpoint returned non-JSON`, { status: response.status, contentType: response.headers.get("content-type"), preview: body.slice(0, 240) });
      if (purpose === "order lookup" && response.status >= 500) {
        throw new Error("We couldn’t retrieve this order right now because the store service had a server error. Please try again shortly.");
      }
      throw new Error("We couldn’t connect to the store service just now. Please refresh the page and try again.");
    }
    // App proxy business errors use HTTP 200 so Shopify forwards the JSON body
    // instead of replacing it with a storefront HTML error page.
    if (data?.error) throw new Error(data.error);
    if (!response.ok) throw new Error(`Chat request failed (${response.status}). Please try again.`);
    return data;
  }
  function postProxyData(endpoint, payload) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      form.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    return fetch(endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", accept: "application/json" }, body: form });
  }
  function readStoredChat(key) {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : null;
    } catch { return null; }
  }
  function addMessage(container, text, who, createdAt = Date.now()) {
    const row = document.createElement("div");
    row.className = `sac-message-row ${who === "user" ? "sac-user-row" : "sac-assistant-row"}`;
    if (who !== "user") row.innerHTML = '<span class="sac-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4.5" y="8" width="15" height="11" rx="4"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6M3 12v3M21 12v3"/></svg></span>';
    const content = document.createElement("div");
    content.className = "sac-message-content";
    const bubble = document.createElement("div");
    bubble.className = `sac-msg ${who}`;
    renderRichMessage(bubble, text);
    content.append(bubble);
    const time = document.createElement("time");
    time.className = "sac-message-time";
    const timeValue = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
    time.dateTime = new Date(timeValue).toISOString();
    time.dataset.time = String(timeValue);
    time.textContent = relativeTime(timeValue);
    content.append(time);
    row.append(content);
    container.append(row);
    container.scrollTop = container.scrollHeight;
    return { row, bubble };
  }
  function renderRichMessage(container, value) {
    const text = String(value || "").replace(/\*\*([^*\n]+)\*\*/g, "$1").trim();
    const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    const linkPattern = /(https?:\/\/[^\s<>()]+|[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+)/gi;
    const appendLinkedLine = (parent, line) => {
      let last = 0;
      linkPattern.lastIndex = 0;
      for (const match of line.matchAll(linkPattern)) {
        const index = match.index;
        const fullMatch = match[0];
        const urlValue = /^https?:\/\//i.test(fullMatch);
        const trailing = urlValue ? (fullMatch.match(/[.,!?;:]+$/)?.[0] || "") : "";
        const label = trailing ? fullMatch.slice(0, -trailing.length) : fullMatch;
        if (index > last) parent.append(document.createTextNode(line.slice(last, index)));
        const link = document.createElement("a");
        link.textContent = label;
        link.href = urlValue ? label : `mailto:${label}`;
        if (urlValue) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
        parent.append(link);
        if (trailing) parent.append(document.createTextNode(trailing));
        last = index + fullMatch.length;
      }
      if (last < line.length) parent.append(document.createTextNode(line.slice(last)));
    };
    blocks.forEach((block) => {
      const lines = block.split("\n");
      const isList = lines.length > 1 && lines.every((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line));
      if (isList) {
        const ordered = /^\s*\d+[.)]/.test(lines[0]);
        const list = document.createElement(ordered ? "ol" : "ul");
        lines.forEach((line) => {
          const item = document.createElement("li");
          appendLinkedLine(item, line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""));
          list.append(item);
        });
        container.append(list);
        return;
      }
      const paragraph = document.createElement("p");
      paragraph.className = "sac-rich-paragraph";
      lines.forEach((line, index) => {
        if (index) paragraph.append(document.createElement("br"));
        appendLinkedLine(paragraph, line);
      });
      container.append(paragraph);
    });
  }
  function relativeTime(timestamp) {
    if (!Number.isFinite(timestamp)) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  function addTicketReference(row, reference) {
    const content = row.querySelector(".sac-message-content");
    const time = content?.querySelector(".sac-message-time");
    if (!content) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sac-ticket-reference";
    button.setAttribute("aria-label", `Copy ticket number ${reference}`);
    const label = document.createElement("span");
    label.className = "sac-ticket-reference-label";
    label.textContent = "TICKET NUMBER";
    const number = document.createElement("strong");
    number.textContent = reference;
    const copy = document.createElement("span");
    copy.className = "sac-ticket-copy-label";
    copy.textContent = "Copy";
    button.append(label, number, copy);
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(reference);
        copy.textContent = "Copied ✓";
      } catch {
        const temporary = document.createElement("textarea");
        temporary.value = reference;
        temporary.setAttribute("readonly", "");
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.append(temporary);
        temporary.select();
        const copied = document.execCommand("copy");
        temporary.remove();
        copy.textContent = copied ? "Copied ✓" : "Select to copy";
      }
      window.setTimeout(() => { copy.textContent = "Copy"; }, 1800);
    });
    if (time) content.insertBefore(button, time);
    else content.append(button);
  }
  function renderFaqs(faqs, section, list, sendMessage) {
    list.replaceChildren();
    faqs.slice(0, 6).forEach((faq) => {
      if (!faq?.question) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sac-faq-chip";
      button.setAttribute("aria-label", `Ask: ${faq.question}`);
      const marker = document.createElement("span");
      marker.className = "sac-faq-icon";
      marker.textContent = "Q";
      const question = document.createElement("span");
      question.className = "sac-faq-question";
      question.textContent = faq.question;
      const arrow = document.createElement("span");
      arrow.className = "sac-faq-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "›";
      button.append(marker, question, arrow);
      button.addEventListener("click", () => sendMessage(faq.question, { faqId: faq.id }));
      list.append(button);
    });
    section.hidden = list.childElementCount === 0;
  }
  function renderFlowChoices(row, flow, sendMessage) {
    if (!flow || !Array.isArray(flow.choices) || !flow.choices.length) return;
    const content = row.querySelector(".sac-message-content");
    if (!content) return;
    const group = document.createElement("div");
    group.className = "sac-flow-choices";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Choose a next step");
    flow.choices.slice(0, 6).forEach((choice) => {
      if (!choice?.id || !choice?.label) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sac-flow-choice";
      button.textContent = choice.label;
      button.addEventListener("click", () => sendMessage(choice.label, { flow: { id: flow.id, stepId: flow.stepId, choiceId: choice.id } }));
      group.append(button);
    });
    const time = content.querySelector(".sac-message-time");
    if (time) content.insertBefore(group, time);
    else content.append(group);
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  async function renderProducts(container, products, options = {}) {
    const wrap = document.createElement("div");
    wrap.className = "sac-products";
    if (options.purchaseIntent) wrap.dataset.purchaseIntent = "true";
    const rootUrl = window.Shopify?.routes?.root || "/";
    const currentProducts = await Promise.all(products.map(async (product) => {
      if (!product.handle) return { ...product, url: product.url || "" };
      try {
        const response = await fetch(`${rootUrl}products/${encodeURIComponent(product.handle)}.js`, { headers: { accept: "application/json" }, cache: "no-store" });
        if (!response.ok) return { ...product, url: product.url || `${rootUrl}products/${encodeURIComponent(product.handle)}` };
        const current = await response.json();
        return {
          ...product,
          title: current.title || product.title,
          image: current.featured_image || current.images?.[0] || product.image,
          description: String(current.description || current.description_html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || product.description || "",
          url: current.url || `${rootUrl}products/${encodeURIComponent(product.handle)}`,
          priceCents: Number(current.price_min ?? current.price ?? 0),
          variants: (current.variants || []).map((variant) => ({ id: variant.id, title: variant.public_title || variant.title, priceCents: Number(variant.price || 0), availableForSale: variant.available !== false })),
        };
      } catch { return { ...product, url: product.url || `${rootUrl}products/${encodeURIComponent(product.handle)}` }; }
    }));
    const currency = window.Shopify?.currency?.active || "USD";
    const formatCents = (value) => {
      try { return new Intl.NumberFormat(document.documentElement.lang || "en", { style: "currency", currency }).format(Number(value) / 100); }
      catch { return `${currency} ${(Number(value) / 100).toFixed(2)}`; }
    };
    currentProducts.filter(Boolean).slice(0, 5).forEach((product) => {
      const card = document.createElement("article");
      card.className = "sac-card";
      const mediaContent = product.image ? document.createElement("img") : createProductPlaceholder();
      if (product.image) {
        mediaContent.src = product.image;
        mediaContent.alt = product.title || "";
        mediaContent.loading = "lazy";
        mediaContent.addEventListener("error", () => mediaContent.replaceWith(createProductPlaceholder()), { once: true });
      }
      const media = product.url ? document.createElement("a") : document.createElement("div");
      media.className = "sac-card-media";
      if (product.url) { media.href = product.url; media.target = "_blank"; media.rel = "noopener noreferrer"; media.setAttribute("aria-label", `View ${product.title || "product"}`); }
      media.append(mediaContent);
      const info = document.createElement("div");
      info.className = "sac-card-info";
      const titleRow = document.createElement("div");
      titleRow.className = "sac-card-title-row";
      const title = product.url ? document.createElement("a") : document.createElement("strong");
      title.className = "sac-card-title";
      title.textContent = product.title || "Product";
      if (product.url) { title.href = product.url; title.target = "_blank"; title.rel = "noopener noreferrer"; }
      titleRow.append(title);
      const productTags = Array.isArray(product.tags) ? product.tags : String(product.tags || "").split(",");
      const isBestSeller = product.bestSeller === true || product.isBestSeller === true || productTags.some((tag) => /best[\s_-]*sell|bestseller/i.test(String(tag)));
      if (isBestSeller) { const badge = document.createElement("span"); badge.className = "sac-best-seller-badge"; badge.textContent = "Best seller"; titleRow.append(badge); }
      if (product.exactMatch === true) { const badge = document.createElement("span"); badge.className = "sac-exact-match-badge"; badge.textContent = "Exact match"; titleRow.append(badge); }
      const price = document.createElement("div"); price.className = "sac-card-price"; price.textContent = Number.isFinite(product.priceCents) ? formatCents(product.priceCents) : (product.price ? `${currency} ${product.price}` : "");
      const allVariants = product.variants || [];
      const availableVariants = allVariants.filter((value) => value.availableForSale !== false);
      const outOfStock = allVariants.length > 0 && availableVariants.length === 0;
      info.append(titleRow, price);
      if (product.description) { const description = document.createElement("p"); description.className = "sac-card-description"; description.textContent = product.description; info.append(description); }
      const variant = document.createElement("select"); variant.setAttribute("aria-label", `Choose ${product.title || "product"} variant`);
      availableVariants.forEach((value) => { const option = document.createElement("option"); option.value = String(value.id).split("/").pop(); option.textContent = `${value.title}${Number.isFinite(value.priceCents) ? ` · ${formatCents(value.priceCents)}` : ""}`; variant.append(option); });
      if (availableVariants.length > 1 || (availableVariants.length === 1 && !/^default title$/i.test(availableVariants[0].title || ""))) info.append(variant);
      variant.addEventListener("change", () => { const selected = product.variants.find((value) => String(value.id).split("/").pop() === variant.value); if (selected && Number.isFinite(selected.priceCents)) price.textContent = formatCents(selected.priceCents); });
      if (outOfStock) { const stock = document.createElement("span"); stock.className = "sac-stock-badge is-out"; stock.textContent = "Out of stock"; info.append(stock); }
      const add = document.createElement("button"); add.type = "button"; add.textContent = outOfStock ? "Unavailable" : options.purchaseIntent ? "Yes — add to cart & checkout" : "Add to cart"; if (options.purchaseIntent) add.classList.add("sac-purchase-confirm"); add.disabled = outOfStock || !variant.value;
      add.addEventListener("click", async () => {
        const originalLabel = add.textContent;
        add.disabled = true;
        add.textContent = "Adding…";
        try {
          const rootPath = window.Shopify?.routes?.root || "/";
          const response = await fetch(`${rootPath}cart/add.js`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ items: [{ id: Number(variant.value), quantity: 1 }] }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.description || payload.message || "Could not add this item.");
          const cartResponse = await fetch(`${rootPath}cart.js`, { headers: { accept: "application/json" }, cache: "no-store" });
          const cart = cartResponse.ok ? await cartResponse.json() : null;
          document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true, detail: { cart, item: payload } }));
          document.dispatchEvent(new CustomEvent("cart:updated", { bubbles: true, detail: { cart, item: payload } }));
          document.dispatchEvent(new CustomEvent("cart:change", { bubbles: true, detail: { cart, item: payload } }));
          updateThemeCart(cart, rootPath);
          animateProductToCart(media, product.url);
          add.textContent = "Added ✓";
          add.classList.add("is-added");
          if (options.purchaseIntent) {
            add.textContent = "Added — opening checkout…";
            window.setTimeout(() => { window.location.assign(`${rootPath}checkout`); }, 650);
            return;
          }
          window.setTimeout(() => { add.textContent = originalLabel; add.classList.remove("is-added"); add.disabled = false; }, 1800);
        } catch (error) {
          add.textContent = error.message || "Try again";
          window.setTimeout(() => { add.textContent = originalLabel; add.disabled = false; }, 2400);
        }
      });
      info.append(add);
      if (product.url) { const details = document.createElement("a"); details.className = "sac-product-details-link"; details.href = product.url; details.target = "_blank"; details.rel = "noopener noreferrer"; details.textContent = "View product details ↗"; info.append(details); }
      card.append(media, info); wrap.append(card);
    });
    if (wrap.querySelector(".sac-card")) {
      const allProducts = document.createElement("a");
      allProducts.className = "sac-view-all-products";
      allProducts.href = `${rootUrl.replace(/\/?$/, "/")}collections/all`;
      allProducts.target = "_blank";
      allProducts.rel = "noopener noreferrer";
      allProducts.textContent = "View all products ↗";
      wrap.append(allProducts);
      container.append(wrap);
    }
  }
  function createProductPlaceholder() {
    const placeholder = document.createElement("span");
    placeholder.className = "sac-product-placeholder";
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", "Product image unavailable");
    placeholder.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 18h22l3 20H10l3-20Z"/><path d="M18 19v-4a6 6 0 0 1 12 0v4M18 27h12"/></svg>';
    return placeholder;
  }
  function updateThemeCart(cart, rootPath) {
    if (!cart) return;
    const count = Number(cart.item_count || 0);
    document.querySelectorAll("[data-cart-count], .cart-count-bubble span[aria-hidden='true'], .cart-count-bubble span:not(.visually-hidden), #cart-icon-bubble .cart-count-bubble span").forEach((node) => { node.textContent = String(count); });
    document.querySelectorAll(".cart-count-bubble, [data-cart-count-bubble]").forEach((node) => { node.hidden = count === 0; node.classList.toggle("is-empty", count === 0); });
    const cartIcon = document.querySelector("#cart-icon-bubble, a[href$='/cart'], a[href*='/cart']");
    if (cartIcon) {
      cartIcon.classList.remove("animate", "is-empty");
      void cartIcon.offsetWidth;
      cartIcon.classList.add("animate");
      cartIcon.dispatchEvent(new CustomEvent("cart:render", { bubbles: true, detail: { cart } }));
    }
    fetch(`${rootPath}cart?section_id=cart-drawer`, { headers: { accept: "text/html" }, cache: "no-store" })
      .then((response) => response.ok ? response.text() : "")
      .then((html) => {
        if (!html) return;
        const doc = new DOMParser().parseFromString(html, "text/html");
        const freshDrawer = doc.querySelector("cart-drawer");
        const currentDrawer = document.querySelector("cart-drawer");
        if (freshDrawer && currentDrawer) { currentDrawer.innerHTML = freshDrawer.innerHTML; currentDrawer.classList.toggle("is-empty", count === 0); }
      }).catch(() => {});
  }
  function animateProductToCart(source) {
    const target = Array.from(document.querySelectorAll("#cart-icon-bubble, [data-cart-icon], .cart-count-bubble, [aria-label*='cart' i], a[href$='/cart'], a[href*='/cart']"))
      .find((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden"; });
    if (!target || !source || typeof source.getBoundingClientRect !== "function") return;
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!from.width || !to.width) return;
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const flyer = document.createElement("span");
    flyer.className = "sac-cart-bird";
    flyer.setAttribute("aria-hidden", "true");
    flyer.innerHTML = '<svg viewBox="0 0 52 48"><path d="M4 27c8-11 16-17 27-18-3 4-4 8-3 11 6-6 12-9 19-9-4 5-8 9-11 15-5 9-13 15-25 17 5-5 8-10 9-15-5 0-10 0-16-1Z"/><path class="sac-bird-wing" d="M8 25c8-5 15-8 23-9-8 5-13 10-16 17l-4 3c3-6 4-10 4-14-2 0-4 1-7 3Z"/><path class="sac-bird-beak" d="m43 11 7-3-4 7Z"/></svg>';
    flyer.style.left = `${startX - 17}px`;
    flyer.style.top = `${startY - 17}px`;
    document.body.append(flyer);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof flyer.animate !== "function") {
      flyer.remove();
      target.classList.add("sac-cart-arrived");
      window.setTimeout(() => target.classList.remove("sac-cart-arrived"), 550);
      return;
    }
    const compact = window.matchMedia?.("(max-width: 520px)").matches;
    const arc = Math.min(compact ? 42 : 64, Math.max(22, Math.abs(deltaX) * .12));
    const flight = flyer.animate([
      { opacity: 0, transform: "translate3d(0, 10px, 0) rotate(-18deg) scale(.55)" },
      { opacity: 1, offset: .12, transform: "translate3d(0, 0, 0) rotate(-4deg) scale(1)" },
      { opacity: 1, offset: .42, transform: `translate3d(${deltaX * .38}px, ${deltaY * .38 - arc}px, 0) rotate(9deg) scale(.9)` },
      { opacity: 1, offset: .76, transform: `translate3d(${deltaX * .78}px, ${deltaY * .78 - arc * .42}px, 0) rotate(22deg) scale(.7)` },
      { opacity: .94, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(34deg) scale(.28)` },
    ], { duration: compact ? 780 : 900, easing: "cubic-bezier(.2,.72,.25,1)", fill: "forwards" });
    const wing = flyer.querySelector(".sac-bird-wing");
    if (wing?.animate) wing.animate([
      { transform: "rotate(0deg)" }, { transform: "rotate(-30deg)" }, { transform: "rotate(5deg)" },
    ], { duration: 190, iterations: Math.ceil((compact ? 780 : 900) / 190), easing: "ease-in-out" });
    flight.onfinish = () => { flyer.remove(); target.classList.add("sac-cart-arrived"); window.setTimeout(() => target.classList.remove("sac-cart-arrived"), 550); };
  }
})();
