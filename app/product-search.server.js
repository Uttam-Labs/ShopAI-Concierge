const COLOR_WORDS = ["red", "black", "white", "blue", "green", "pink", "yellow", "orange", "purple", "grey", "gray", "brown", "silver", "gold", "beige", "navy"];
const SIZE_WORDS = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "small", "medium", "large", "extra large"];

export function normalizeProductLookup(value) {
  return String(value || "").toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/([\d])[,](?=\d{3}(?:\D|$))/g, "$1")
    .replace(/কালো/g, " black ").replace(/সাদা/g, " white ").replace(/নীল/g, " blue ").replace(/লাল/g, " red ").replace(/সবুজ/g, " green ")
    .replace(/টি\s*-?\s*শার্ট/g, " t shirt ").replace(/শার্ট/g, " shirt ").replace(/দোকানে|তোমাদের|আমাদের|আছে|কী|কি/g, " ")
    .replace(/([\d])[,](?=\d{3}(?:\D|$))/g, "$1")
    .replace(/\b(?:don['’]t|dont)\b/g, "do not").replace(/\b(?:wheres|where's|where’s)\b/g, "where").replace(/\b(?:whats|what's|what’s)\b/g, "what")
    .replace(/\b(?:cheepest|cheep)\b/g, (word) => word === "cheepest" ? "cheapest" : "cheap")
    .replace(/\b(?:t[\s-]*sh(?:i|e)?rts?|tees?)\b/g, " t shirt ")
    .replace(/\bskyblue\b/g, "sky blue")
    .replace(/\bgray\b/g, "grey")
    .replace(/\bproduc(?:t)?s?\b/g, (word) => /s$/i.test(word) ? "products" : "product").replace(/\bproduts\b/g, "products").replace(/\bshooes?\b/g, "shoes")
    .replace(/\bsomthing\b/g, "something").replace(/\bhav\b/g, "have").replace(/\bdoller\b/g, "dollar")
    .replace(/\bplz\b/g, "please").replace(/\bfavou?rites?\b/g, "favorite").replace(/\b(?:u|ur)\b/g, (word) => word.toLowerCase() === "ur" ? "your" : "you")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function productSearchPhrase(value) {
  return String(value || "").replace(/\bdon['’]t\b/gi, "do not").replace(/\b(?:wheres|where's|where’s)\b/gi, "where").replace(/\b(?:whats|what's|what’s)\b/gi, "what")
    .replace(/\bu\b/gi, "you").replace(/\bur\b/gi, "your").replace(/\bsomthing\b/gi, "something")
    .replace(/কালো/g, " black ").replace(/সাদা/g, " white ").replace(/নীল/g, " blue ").replace(/লাল/g, " red ").replace(/সবুজ/g, " green ")
    .replace(/টি\s*-?\s*শার্ট/g, " t shirt ").replace(/শার্ট/g, " shirt ").replace(/দোকানে|তোমাদের|আমাদের|আছে|কী|কি/g, " ")
    .replace(/\b(?:marked as|which are|marked)\b/gi, " ").replace(/\bsellers?\b/gi, " selling ")
    .replace(/\b(?:cheepest|cheep)\b/gi, (word) => word.toLowerCase() === "cheepest" ? "cheapest" : "cheap")
    .replace(/\b(?:t[\s-]*sh(?:i|e)?rts?|tees?)\b/gi, " t shirt ").replace(/\bskyblue\b/gi, "sky blue").replace(/\bgray\b/gi, "grey")
    .replace(/\bshooes?\b/gi, "shoes").replace(/\bproduts?\b/gi, "products").replace(/\bproduc\b/gi, "product").replace(/\bdoller\b/gi, "dollar").replace(/\bplz\b/gi, "please").replace(/\bfavou?rites?\b/gi, "favorite")
    .replace(/\btop\s+(?:\d+\s+)?(?:products?|selling|rated)\b/gi, " ")
    .replace(/\bcustomer\s+favorites?\b/gi, " ")
    .replace(/\b(?:sort by|high to low|low to high)\b/gi, " ")
    .replace(/\b[1-5]\s*stars?\b/gi, " ")
    .replace(/\b\d+\s*%\s*(?:off|discount)\b/gi, " ")
    .replace(/\bbetween\s*(?:(?:rs\.?|inr|rupees?|dollars?|usd)\s*)?[$£€₹]?\s*\d[\d,.]*\s*(?:and|to|-)\s*(?:(?:rs\.?|inr|rupees?|dollars?|usd)\s*)?[$£€₹]?\s*\d[\d,.]*/gi, " ")
    .replace(/\b(?:price|cost)\s*[: ]\s*[$£€₹]?\s*\d[\d,.]*\s*(?:and|to|-)\s*[$£€₹]?\s*\d[\d,.]*/gi, " ")
    .replace(/\b(?:less than|under|below|up to|at most|maximum|max|over|above|more than|greater than|at least|minimum|min|around|about|approximately)\s*(?:(?:rs\.?|inr|rupees?)\s*)?[$£€₹]?\s*\d[\d,.]*/gi, " ")
    .replace(/\b(?:for|budget of|within)\s*(?:(?:rs\.?|inr|rupees?)\s*)?[$£€₹]?\s*\d[\d,.]*/gi, " ")
    .replace(/(?:rs\.?|inr|rupees?|dollars?|usd)\s*[$£€₹]?\s*\d[\d,.]*|[$£€₹]\s*\d[\d,.]*|\d[\d,.]*\s*(?:dollars?|usd|rupees?)/gi, " ")
    .replace(/^\s*(?:what(?:'s|’s| is)|how much (?:is|does)|tell me about|describe|details? (?:for|about))\s+/i, "")
    .replace(/^\s*(?:the|a|an)\s+/i, "")
    .replace(/^\s*(?:please\s+)?(?:can you|could you)\s+/i, "").replace(/^(?:do you have|have you got|is there|can i (?:get|see)|where can i (?:find|buy)|where is)\s+/i, "")
    .replace(/^(?:i(?:'m|’m| am)?\s+)?(?:shopping for|want(?:\s+to\s+(?:buy|purchase|find))?|would like(?:\s+to\s+(?:buy|purchase|find))?|would love(?:\s+to\s+(?:buy|purchase|find))?|plan(?:ning)?(?:\s+to\s+(?:buy|purchase|find))?|need|looking for|searching for|show me|find me|find|search for|search|look for|buy|purchase|recommend)\s+/i, "")
    .replace(/\b(?:can you|could you|please|help|find|search|product|products|item|items|catalog|collection|sku|any|show|me|in|colors?|colours?|color|colour|colored|coloured|featured|model|brand|company|under|below|less than|over|above|more than|greater than|at least|at most|between|price|cost|budget|dollars?|usd|rupees?|cheap|cheapest|affordable|discount|discounted|sale|deal|deals|hot|off|premium|for|with|size|sizes|small|medium|large|available|anything|something|in stock|showing|stock|new|latest|arrival|arrivals|best|selling|seller|sellers|sell|top|popular|trending|similar|recommend|recommended|recommendations?|suggest|compare|most|expensive|priciest|highest|costliest|rating|rated|star|stars|customer|favorite|favorites|the|a|an|do|you|have|does|is|are|what|much|how|see|it|its|not|without|other|all|men|mens|menswear|male|women|womens|womenswear|female|kids|children|childrens|summer|casual|around|about|approximately|store|in|of|my|your|we|got|any|does|come|gift|gifts|brother|ideas?|suggestions?|one|good|nice|sure|buy|based|needs?|be|been|being|will|would|should|that|this|suitable|sort|s|low|high|i|am|to)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function extractProductFilters(question) {
  const text = normalizeProductLookup(question);
  const priceMatch = text.match(/\b(under|below|less than|up to|at most|maximum|max|over|above|more than|greater than|at least|minimum|min)\s*(?:(?:rs\.?|inr|rupees?)\s*)?(\d[\d,.]*)/i);
  const price = priceMatch ? Number(priceMatch[2].replace(/,/g, "")) : null;
  const comparison = priceMatch?.[1]?.toLocaleLowerCase() || "";
  const statedBudgetMatch = !priceMatch ? /\b(?:for|budget of|within|price|cost)\s*(?:(?:rs\.?|inr|rupees?|dollars?|usd)\s*)?[$£€₹]?\s*(\d[\d,.]*)|\b(\d[\d,.]*)\s*(?:dollars?|usd|rupees?)\b/i.exec(text) : null;
  const statedBudget = statedBudgetMatch?.[1] || statedBudgetMatch?.[2] || null;
  let maxPrice = price !== null && /^(?:under|below|less than|up to|at most|maximum|max)$/.test(comparison) ? price : statedBudget ? Number(statedBudget.replace(/,/g, "")) : null;
  let minPrice = price !== null && /^(?:over|above|more than|greater than|at least|minimum|min)$/.test(comparison) ? price : null;
  const range = String(question || "").toLocaleLowerCase().match(/\bbetween\s*(?:(?:rs\.?|inr|rupees?|dollars?|usd)\s*)?[$£€₹]?(\d[\d,.]*)\s*(?:and|to|-)\s*(?:(?:rs\.?|inr|rupees?|dollars?|usd)\s*)?[$£€₹]?(\d[\d,.]*)|\b(?:price|cost)\s*[: ]\s*[$£€₹]?(\d[\d,.]*)\s*(?:and|to|-)\s*[$£€₹]?(\d[\d,.]*)/i);
  if (range) { const first = range[1] || range[3]; const second = range[2] || range[4]; minPrice = Math.min(Number(first.replace(/,/g, "")), Number(second.replace(/,/g, ""))); maxPrice = Math.max(Number(first.replace(/,/g, "")), Number(second.replace(/,/g, ""))); }
  const targetMatch = text.match(/\b(?:around|about|approximately)\s*(?:(?:rs\.?|inr|rupees?)\s*)?(\d[\d,.]*)/i);
  const priceTarget = targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null;
  const negativeClause = /\b(?:not|no|without|do not want)\b(.+?)(?:\b(?:but|instead|other|except)\b|$)/i.exec(text)?.[1] || "";
  const excludedColors = COLOR_WORDS.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(negativeClause)
    || /\b(?:more colorful|different color|different colour|another color|another colour)\b/i.test(text) && new RegExp(`\\b${color}\\b`, "i").test(text));
  const colors = COLOR_WORDS.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(text) && !excludedColors.includes(color));
  const sizeAlternatives = [...SIZE_WORDS].sort((left, right) => right.length - left.length).join("|");
  const namedSize = new RegExp(`\\b(?:size|in|available in|comes in)\\s+(${sizeAlternatives})\\b|\\b(${sizeAlternatives})\\s+(?:size|t shirt|shirt|tee|hoodie|pants)\\b`, "i").exec(text);
  const rawSize = (namedSize?.[1] || namedSize?.[2] || "").toLowerCase();
  const size = rawSize === "small" ? "s" : rawSize === "medium" ? "m" : rawSize === "large" ? "l" : rawSize === "extra large" ? "xl" : rawSize;
  const numericSize = /\bsize\s*(\d{1,2})\b/i.exec(text)?.[1] || "";
  const audience = /\b(?:women|womens|womenswear|female|girls?)\b/i.test(text) ? "women"
    : /\b(?:men|mens|menswear|male|boys?)\b/i.test(text) ? "men"
      : /\b(?:kids|children|childrens|youth)\b/i.test(text) ? "kids" : "";
  const productType = /\b(?:hoodies?|sweatshirts?)\b/i.test(text) ? "hoodie"
    : /\b(?:pants|trousers?|chinos?|jeans|joggers?)\b/i.test(text) ? "pants"
      : /\b(?:t shirt|t shirts|shirt|shirts|tee)\b/i.test(text) ? "shirt"
        : /\b(?:jackets?|coats?)\b/i.test(text) ? "jacket" : "";
  const features = [];
  if (/\b(?:oversized|oversize)\b/i.test(text)) features.push("oversized");
  if (/\b(?:crew neck|crewneck)\b/i.test(text)) features.push("crew neck");
  if (/\b(?:pocket)\b/i.test(text)) features.push("pocket");
  if (/\blong sleeves?\b/i.test(text)) features.push("long sleeve");
  if (/\bshort sleeves?\b/i.test(text)) features.push("short sleeve");
  if (/\b(?:stripe|striped|stripey|stripes)\b/i.test(text) && !/\b(?:not|without|no)\s+(?:any\s+)?(?:the\s+)?(?:stripe|striped|stripes)\b/i.test(text)) features.push("stripe");
  const excludeFeatures = /\b(?:not|without|no)\s+(?:any\s+)?(?:the\s+)?(?:stripe|striped|stripes)\b/i.test(text) ? ["stripe", "striped"] : [];
  const minRating = Number(/\b([1-5])\s*(?:star|stars|rating)\b/i.exec(text)?.[1] || 0) || null;
  const limit = Math.min(10, Math.max(1, Number(/\btop\s+(\d{1,2})\b/i.exec(text)?.[1] || 5)));
  const saleOnly = /\b(?:sale|discount|discounted|deal|deals|\d+\s*%\s*off)\b/i.test(String(question || ""));
  const discountPercent = Number(/\b(\d{1,2})\s*%\s*(?:off|discount)\b/i.exec(String(question || ""))?.[1] || 0) || null;
  const sort = /\b(?:best rated|top rated|highest rated|\d\s*star(?:s)?|rating)\b/i.test(text) ? "rating-desc"
    : /\b(?:best deals?|hot deals?|highest discount|biggest discount|\d+\s*%\s*off)\b/i.test(String(question || "")) ? "discount-desc"
    : /\b(?:most expensive|priciest|highest price|costliest|expensive|high to low)\b/i.test(text) ? "price-desc"
      : /\b(?:cheapest|cheepest|lowest price|least expensive|low price|best price|low to high|cheap|sort by price)\b/i.test(text) ? "price-asc"
    : /\b(?:best[\s-]*(?:sell(?:er|ing)?|products?)|top\s+(?:\d+\s+)?(?:products?|sell(?:er|ing)?|rated)|most popular|popular|trending|customer favorites?|best seller|bestseller|recommended|recommendations?)\b/i.test(text) ? "best-selling"
          : /\b(?:latest|new arrivals?|new stock|newest)\b/i.test(text) ? "newest" : "relevance";
  const brandMatch = text.match(/\b(?:brand|company|from|by)\s+([a-z0-9][a-z0-9&' -]{1,35}?)(?=\s+(?:in|with|under|below|less|over|above|more|price|cost|for|size|color|colour)\b|[,?.]|$)/i);
  return { colors, excludedColors, size: numericSize || size, audience, brand: brandMatch?.[1]?.trim() || (text.includes("titan") ? "Titan" : ""), minPrice, maxPrice, priceTarget, minRating, saleOnly, discountPercent, limit, availability: /\b(?:in stock|available|available now)\b/i.test(text) ? "available" : /\b(?:out of stock|unavailable)\b/i.test(text) ? "unavailable" : "", productType, features, excludeFeatures, sort };
}

export function productRelevance(product, phrase) {
  const terms = [...new Set(normalizeProductLookup(phrase).split(/\s+/).filter((term) => term.length > 1))];
  if (!terms.length) return 0;
  const fields = [product.title, product.handle, product.description, product.vendor, product.productType, ...(product.tags || []), ...(product.collections || []).flatMap((collection) => [collection.title, collection.handle]), ...(product.metafields || []).map((field) => `${field.namespace} ${field.key} ${field.value}`), ...(product.variants || []).flatMap((variant) => [variant.title, variant.sku, variant.price, ...(variant.selectedOptions || []).map((option) => option.value)])];
  const haystack = normalizeProductLookup(fields.join(" "));
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

export function productRating(product) {
  for (const field of product.metafields || []) {
    if (!/rating|stars?/i.test(`${field.namespace || ""} ${field.key || ""}`)) continue;
    const raw = String(field.value || "").trim();
    try {
      const parsed = JSON.parse(raw);
      const value = Number(parsed?.value ?? parsed?.rating ?? parsed?.average ?? parsed?.averageRating);
      if (Number.isFinite(value)) return value;
    } catch { /* Rating metafields are often plain numeric strings. */ }
    const value = Number(raw.match(/\d+(?:\.\d+)?/)?.[0]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function productMatchesFilters(product, filters) {
  const title = normalizeProductLookup(product.title);
  const fields = normalizeProductLookup([product.title, product.description, product.vendor, product.productType, ...(product.tags || []), ...(product.collections || []).flatMap((item) => [item.title, item.handle]), ...(product.metafields || []).map((field) => `${field.namespace} ${field.key} ${field.value}`), ...(product.variants || []).flatMap((variant) => [variant.title, ...(variant.selectedOptions || []).map((option) => option.value)])].join(" "));
  if (filters.colors?.length && !filters.colors.some((color) => fields.split(" ").includes(color))) return false;
  if (filters.excludedColors?.some((color) => fields.split(" ").includes(color) || (color === "blue" && /\bnavy\b/.test(fields)))) return false;
  if (filters.brand && !fields.includes(normalizeProductLookup(filters.brand)) && !normalizeProductLookup(product.vendor).includes(normalizeProductLookup(filters.brand))) return false;
  if (filters.audience && !new RegExp(`\\b(?:${filters.audience === "women" ? "women|womens|female|girl" : filters.audience === "men" ? "men|mens|male|boy" : "kids|children|child|youth"})s?\\b`).test(fields)) return false;
  if (filters.productType && !(filters.productType === "shirt" ? /\b(?:t shirt|shirt|tee)\b/.test(title) : filters.productType === "pants" ? /\b(?:pants|trousers|chinos|jeans|joggers)\b/.test(title) : title.includes(filters.productType))) return false;
  if (filters.features?.some((feature) => !fields.includes(normalizeProductLookup(feature)))) return false;
  if (filters.excludeFeatures?.some((feature) => fields.includes(normalizeProductLookup(feature)))) return false;
  const prices = (product.variants || []).filter((variant) => variant.availableForSale !== false && variant.price !== undefined).map((variant) => Number(variant.price)).filter(Number.isFinite);
  if (filters.minPrice !== null && filters.minPrice !== undefined && (!prices.length || !prices.some((price) => price >= filters.minPrice))) return false;
  if (filters.maxPrice !== null && filters.maxPrice !== undefined && (!prices.length || !prices.some((price) => price < filters.maxPrice))) return false;
  if (filters.priceTarget !== null && filters.priceTarget !== undefined && (!prices.length || !prices.some((price) => Math.abs(price - filters.priceTarget) <= Math.max(50, filters.priceTarget * 0.15)))) return false;
  const saleVariants = (product.variants || []).filter((variant) => Number(variant.compareAtPrice) > Number(variant.price) && Number(variant.price) > 0);
  if (filters.saleOnly && !saleVariants.length && !/\b(?:sale|discount|deal|clearance)\b/i.test(fields)) return false;
  if (filters.discountPercent !== null && filters.discountPercent !== undefined && !saleVariants.some((variant) => ((Number(variant.compareAtPrice) - Number(variant.price)) / Number(variant.compareAtPrice)) * 100 >= filters.discountPercent)) return false;
  const rating = productRating(product);
  if (filters.minRating && (rating === null || rating < filters.minRating)) return false;
  if (filters.size) {
    const desired = filters.size === "m" ? "medium" : filters.size === "l" ? "large" : filters.size === "s" ? "small" : filters.size;
    const knownSizeToken = new Set([...SIZE_WORDS, "medium", "large", "small"]);
    const titleOrMetadataHasSize = fields.split(" ").some((token) => knownSizeToken.has(token) && (token === desired || token === filters.size));
    const variantHasSize = product.variants?.some((variant) => variant.selectedOptions?.some((option) => {
      const optionValue = normalizeProductLookup(option.value);
      return optionValue === desired || optionValue === filters.size;
    }));
    if (!titleOrMetadataHasSize && !variantHasSize) return false;
  }
  if (filters.availability === "available" && product.variants?.length && !product.variants.some((variant) => variant.availableForSale !== false)) return false;
  if (filters.availability === "unavailable" && (!product.variants?.length || product.variants.some((variant) => variant.availableForSale !== false))) return false;
  return true;
}
