(() => {
  document.querySelectorAll(".sac-root:not([data-mounted])").forEach((root) => {
    root.dataset.mounted = "true";
    const accent = root.dataset.accent || "#f97316";
    const background = root.dataset.background || "#ffffff";
    const textColor = root.dataset.text || "#171717";
    const fontSize = `${Number(root.dataset.fontSize) || 14}px`;
    const width = `${Number(root.dataset.width) || 380}px`;
    const shop = window.Shopify?.shop || location.hostname;
    const apiEndpoint = `${window.Shopify?.routes?.root || "/"}apps/shopai-concierge`;
    const sessionId = crypto.randomUUID();

    const panel = document.createElement("section");
    panel.className = "sac-panel";
    panel.setAttribute("aria-label", "ShopAI customer support chat");
    setThemeVariables(panel, { accent, background, textColor, fontSize, width });
    panel.innerHTML = `<div class="sac-head"><div class="sac-brand"><span class="sac-brand-mark">✦</span><div class="sac-brand-copy"><strong>${escapeHtml(root.dataset.title || "How can we help?")}</strong><span class="sac-live">Here to help</span></div></div><button class="sac-close" type="button" aria-label="Close chat">×</button></div><div class="sac-welcome">Product advice <i></i> Order updates <i></i> Store support</div><div class="sac-messages" aria-live="polite"><div class="sac-msg sac-greeting">Hi there! 👋 Tell me what you’re shopping for, ask about our policies, or track an order.</div><div class="sac-faqs" hidden><div class="sac-faq-heading"><span>POPULAR QUESTIONS</span><small>Tap to ask</small></div><div class="sac-faq-list"></div></div></div><div class="sac-form-wrap"><form class="sac-form"><input class="sac-input" maxlength="1000" autocomplete="off" placeholder="Ask us anything…" aria-label="Your message"><button class="sac-send" type="submit" aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg></button></form><div class="sac-footer">Powered by <span>ShopAI Concierge</span></div></div>`;

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
    const enableFaqs = root.dataset.enableFaq !== "false";
    const enableRecommendations = root.dataset.enableRecommendations !== "false";

    if (enableFaqs) {
      fetch(`${apiEndpoint}?shop=${encodeURIComponent(shop)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((config) => {
          if (!config) return;
          if (config.greeting) panel.querySelector(".sac-greeting").textContent = config.greeting;
          if (enableFaqs && Array.isArray(config.faqs) && config.faqs.length) renderFaqs(config.faqs, faqSection, faqList, sendMessage);
        })
        .catch(() => {});
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

    async function sendMessage(rawMessage) {
      const message = String(rawMessage || "").trim();
      if (!message || form.dataset.sending === "true") return;
      addMessage(messages, message, "user");
      input.value = "";
      form.dataset.sending = "true";
      panel.querySelector(".sac-send").disabled = true;
      const pending = addMessage(messages, "Let me check that for you…", "assistant pending");
      try {
        const response = await fetch(`${apiEndpoint}?shop=${encodeURIComponent(shop)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, shop, sessionId, pageUrl: location.href }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "I couldn’t complete that request. Please try again.");
        pending.remove();
        addMessage(messages, data.answer || "I’m sorry, I couldn’t find an answer to that just yet.", "assistant");
        if (enableRecommendations && Array.isArray(data.products) && data.products.length) renderProducts(messages, data.products.slice(0, 4));
      } catch (error) {
        pending.classList.remove("pending");
        pending.classList.add("error");
        pending.textContent = error.message || "Something went wrong. Please try again.";
      } finally {
        form.dataset.sending = "false";
        panel.querySelector(".sac-send").disabled = false;
        messages.scrollTop = messages.scrollHeight;
      }
    }
  });

  function setThemeVariables(element, values) {
    element.style.setProperty("--sac-accent", values.accent);
    element.style.setProperty("--sac-bg", values.background);
    element.style.setProperty("--sac-text", values.textColor);
    element.style.setProperty("--sac-width", values.width);
    element.style.setProperty("--sac-font", values.fontSize);
  }
  function addMessage(container, text, who) {
    const div = document.createElement("div");
    div.className = `sac-msg ${who}`;
    div.textContent = text;
    container.append(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }
  function renderFaqs(faqs, section, list, sendMessage) {
    list.replaceChildren();
    faqs.slice(0, 6).forEach((faq) => {
      if (!faq?.question) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sac-faq-chip";
      button.textContent = faq.question;
      button.addEventListener("click", () => sendMessage(faq.question));
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
