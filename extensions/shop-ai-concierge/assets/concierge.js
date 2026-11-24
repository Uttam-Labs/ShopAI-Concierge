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
    let chatHistory = Array.isArray(storedChat?.messages)
      ? storedChat.messages.filter((item) => !(item?.role === "assistant" && /Unexpected token|not valid JSON|returned a web page instead of chat data/i.test(String(item.content || "")))).slice(-40)
      : [];
    const botAvatar = '<span class="sac-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4.5" y="8" width="15" height="11" rx="4"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6M3 12v3M21 12v3"/></svg></span>';

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

    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "sac-launch";
    launcher.setAttribute("aria-label", "Open chat");
    launcher.setAttribute("aria-expanded", "false");
    setThemeVariables(launcher, { accent, background, textColor, fontSize, width });
    const icon = root.dataset.icon || "chat";
    launcher.innerHTML = icon === "help" ? "<span class=\"sac-help-icon\">?</span>" : icon === "spark" ? "<span class=\"sac-spark-icon\">✦</span>" : "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z\"/></svg>";
    document.body.append(panel, launcher);

    const messages = panel.querySelector(".sac-messages");
    const form = panel.querySelector(".sac-form");
    const input = panel.querySelector(".sac-input");
    const faqSection = panel.querySelector(".sac-faqs");
    const faqList = panel.querySelector(".sac-faq-list");
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
    const formWrap = panel.querySelector(".sac-form-wrap");
    const persistChat = () => {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ sessionId, identity, messages: chatHistory.slice(-40) })); } catch { /* Session storage can be disabled by the browser. */ }
    };
    if (chatHistory.length) {
      initialGreeting.remove();
      chatHistory.forEach((item) => addMessage(messages, item.content, item.role === "user" ? "user" : "assistant", item.createdAt));
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
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage(input.value);
    });

    async function sendMessage(rawMessage, options = {}) {
      const message = String(rawMessage || "").trim();
      const faqId = typeof options.faqId === "string" ? options.faqId : "";
      if (!message || form.dataset.sending === "true") return;
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
        const response = await fetch(apiEndpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ message, shop, sessionId, customerName: identity?.name || "", customerEmail: identity?.email || "", pageUrl: location.href, ...(faqId ? { faqId } : {}) }) });
        const data = await readApiJson(response, "chat reply");
        if (!response.ok) throw new Error(data.error || "I couldn’t complete that request. Please try again.");
        pending.row.remove();
        const answer = data.answer || "I’m sorry, I couldn’t find an answer to that just yet.";
        addMessage(messages, answer, "assistant");
        chatHistory.push({ role: "assistant", content: answer, createdAt: Date.now() });
        persistChat();
        if (enableRecommendations && Array.isArray(data.products) && data.products.length) renderProducts(messages, data.products.slice(0, 4));
      } catch (error) {
        pending.bubble.classList.remove("pending");
        pending.bubble.classList.add("error");
        pending.bubble.textContent = error.message || "Something went wrong. Please try again.";
        chatHistory.push({ role: "assistant", content: pending.bubble.textContent, createdAt: Date.now() });
        persistChat();
      } finally {
        form.dataset.sending = "false";
        panel.querySelector(".sac-send").disabled = false;
        messages.scrollTop = messages.scrollHeight;
      }
    }

    const closeSupport = () => { supportBackdrop.hidden = true; };
    panel.querySelector(".sac-help-button").addEventListener("click", () => {
      const supportValues = supportForm.elements;
      supportValues.customerName.value = identity?.name === "Anonymous shopper" ? "" : identity?.name || "";
      supportValues.customerEmail.value = identity?.email || "";
      supportIssueType.value = "";
      supportGuidance.hidden = true;
      supportQuestion.textContent = "";
      supportAnswer.textContent = "";
      supportIssueDetails.required = false;
      supportIssueDetails.value = "";
      panel.querySelector(".sac-support-notice").textContent = identity?.email
        ? (root.dataset.supportSavedEmailNotice || "Saved for this chat: {email}. Confirm it or enter a different email.").replace("{email}", identity.email)
        : (root.dataset.supportContactNotice || "Please add a name and email so the team can reply to your request.");
      supportBackdrop.hidden = false;
      (identity?.email ? supportValues.customerName : supportValues.customerEmail).focus();
    });
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
      if (!requestTypeId) { notice.textContent = "Choose a support topic before creating your request."; supportIssueType.focus(); return; }
      submit.disabled = true;
      submit.textContent = root.dataset.supportSubmittingLabel || "Creating ticket…";
      notice.textContent = "";
      try {
        const ticketMessage = "I would like to submit a support request.";
        const response = await fetch(apiEndpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ message: ticketMessage, shop, sessionId, customerName: name, customerEmail: email, supportRequest: true, requestTypeId, requestDetails, supportContext: chatHistory.slice(-12).map(({ role, content }) => ({ role, content })), supportSuccessMessage: root.dataset.supportSuccessMessage || "" }) });
        const data = await readApiJson(response, "support ticket");
        if (!response.ok) throw new Error(data.error || "We couldn’t create your ticket. Please try again.");
        identity = { name, email };
        const ticketReply = data.answer;
        chatHistory.push({ role: "user", content: ticketMessage, createdAt: Date.now() }, { role: "assistant", content: ticketReply, createdAt: Date.now() });
        persistChat();
        addMessage(messages, ticketMessage, "user");
        addMessage(messages, ticketReply, "assistant");
        closeSupport();
      } catch (error) {
        notice.textContent = error.message || "We couldn’t create your ticket. Please try again.";
      } finally {
        submit.disabled = false;
        submit.textContent = root.dataset.supportSubmitLabel || "Create support ticket";
      }
    });
    window.addEventListener("beforeunload", (event) => {
      if (chatHistory.some((item) => item.role === "user") || input.value.trim()) {
        event.preventDefault();
        event.returnValue = "";
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
      throw new Error("Shopify returned a web page instead of chat data. Check that the app proxy is enabled on the active Shopify app version.");
    }
    if (!response.ok) throw new Error(data?.error || `Chat request failed (${response.status}). Please try again.`);
    return data;
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
    bubble.textContent = text;
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
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function renderProducts(container, products) {
    const wrap = document.createElement("div");
    wrap.className = "sac-products";
    products.forEach((product) => {
      const card = document.createElement("article");
      card.className = product.image ? "sac-card has-image" : "sac-card";
      if (product.image) { const image = document.createElement("img"); image.src = product.image; image.alt = product.title || ""; image.loading = "lazy"; card.append(image); }
      const info = document.createElement("div");
      info.className = "sac-card-info";
      const title = document.createElement("strong"); title.textContent = product.title || "Product";
      const price = document.createElement("div"); price.className = "sac-card-price"; price.textContent = product.price ? `$${product.price}` : "";
      info.append(title, price);
      const variant = document.createElement("select"); variant.setAttribute("aria-label", `Choose ${product.title || "product"} variant`);
      (product.variants || []).filter((value) => value.availableForSale !== false).forEach((value) => { const option = document.createElement("option"); option.value = String(value.id).split("/").pop(); option.textContent = `${value.title}${value.price ? ` · $${value.price}` : ""}`; variant.append(option); });
      const add = document.createElement("button"); add.type = "button"; add.textContent = "Add to cart"; add.disabled = !variant.value;
      add.addEventListener("click", async () => { add.disabled = true; try { const result = await fetch(`${window.Shopify?.routes?.root || "/"}cart/add.js`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ items: [{ id: Number(variant.value), quantity: 1 }] }) }); if (!result.ok) throw new Error(); document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true })); document.dispatchEvent(new CustomEvent("cart:updated", { bubbles: true })); add.textContent = "Added to cart ✓"; } catch { add.textContent = "Try again"; add.disabled = false; } });
      info.append(variant, add); card.append(info); wrap.append(card);
    });
    if (wrap.childElementCount) container.append(wrap);
  }
})();
