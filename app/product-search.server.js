const COLOR_WORDS = ["red", "black", "white", "blue", "green", "pink", "yellow", "orange", "purple", "grey", "gray", "brown", "silver", "gold", "beige", "navy"];
const SIZE_WORDS = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "small", "medium", "large", "extra large"];

export function normalizeProductLookup(value) {
  return String(value || "").toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:don['’]t|dont)\b/g, "do not").replace(/\b(?:wheres|where's|where’s)\b/g, "where").replace(/\b(?:whats|what's|what’s)\b/g, "what")
    .replace(/\b(?:cheepest|cheep)\b/g, (word) => word === "cheepest" ? "cheapest" : "cheap")
    .replace(/\b(?:t[\s-]*sh(?:i|e)?rts?|tees?)\b/g, " t shirt ")
    .replace(/\bskyblue\b/g, "sky blue")
    .replace(/\bgray\b/g, "grey")
    .replace(/\bproduc\b/g, "product").replace(/\bshooes?\b/g, "shoes")
    .replace(/\bsomthing\b/g, "something").replace(/\bhav\b/g, "have")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function productSearchPhrase(value) {
  return String(value || "").replace(/\bdon['’]t\b/gi, "do not").replace(/\b(?:wheres|where's|where’s)\b/gi, "where").replace(/\b(?:whats|what's|what’s)\b/gi, "what")
    .replace(/\b(?:cheepest|cheep)\b/gi, (word) => word.toLowerCase() === "cheepest" ? "cheapest" : "cheap")
    .replace(/\b(?:t[\s-]*sh(?:i|e)?rts?|tees?)\b/gi, " t shirt ").replace(/\bskyblue\b/gi, "sky blue").replace(/\bgray\b/gi, "grey")
    .replace(/\bshooes?\b/gi, "shoes").replace(/\bproduc\b/gi, "product")
    .replace(/\bbetween\s*(?:(?:rs\.?|inr|rupees?)\s*)?[$£€₹]?\s*\d[\d,.]*\s*(?:and|to|-)\s*(?:(?:rs\.?|inr|rupees?)\s*)?[$£€₹]?\s*\d[\d,.]*/gi, " ")
    .replace(/\b(?:less than|under|below|up to|at most|maximum|max|over|above|more than|greater than|at least|minimum|min|around|about|approximately)\s*(?:(?:rs\.?|inr|rupees?)\s*)?[$£€₹]?\s*\d[\d,.]*/gi, " ")
    .replace(/\b(?:for|budget of|within)\s*(?:(?:rs\.?|inr|rupees?)\s*)?[$£€₹]?\s*\d[\d,.]*/gi, " ")
    .replace(/(?:rs\.?|inr|rupees?)\s*[$£€₹]?\s*\d[\d,.]*|[$£€₹]\s*\d[\d,.]*/gi, " ")
    .replace(/^\s*(?:what(?:'s|’s| is)|how much (?:is|does)|tell me about|describe|details? (?:for|about))\s+/i, "")
    .replace(/^\s*(?:the|a|an)\s+/i, "")
    .replace(/^\s*(?:please\s+)?(?:can you|could you)\s+/i, "").replace(/^(?:do you have|have you got|is there|can i (?:get|see)|where can i (?:find|buy)|where is)\s+/i, "")
    .replace(/^(?:i(?:'m|’m| am)?\s+)?(?:want(?:\s+to\s+(?:buy|purchase|find))?|would like(?:\s+to\s+(?:buy|purchase|find))?|would love(?:\s+to\s+(?:buy|purchase|find))?|plan(?:ning)?(?:\s+to\s+(?:buy|purchase|find))?|need|looking for|searching for|show me|find me|find|search for|search|look for|buy|purchase|recommend)\s+/i, "")
    .replace(/\b(?:can you|could you|please|product|products|item|items|sku|any|show|me|in|color|colour|colored|coloured|model|brand|company|under|below|less than|over|above|more than|greater than|at least|at most|between|price|cost|budget|cheap|cheapest|affordable|discounted|sale|premium|for|with|size|sizes|small|medium|large|available|in stock|showing|new|latest|arrival|arrivals|best|selling|popular|trending|similar|recommendations|compare|most|expensive|priciest|highest|costliest|the|a|an|do|you|have|does|is|are|what|much|how|see|it|its|not|without|other|all|men|women|kids|summer|casual|around|about|approximately|store|in|of|my|your|we|got|any|does|come)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
}

export function extractProductFilters(question) {
  const text = normalizeProductLookup(question);
  const priceMatch = text.match(/\b(under|below|less than|up to|at most|maximum|max|over|above|more than|greater than|at least|minimum|min)\s*(?:(?:rs\.?|inr|rupees?)\s*)?(\d[\d,.]*)/i);
  const price = priceMatch ? Number(priceMatch[2].replace(/,/g, "")) : null;
  const comparison = priceMatch?.[1]?.toLocaleLowerCase() || "";
  const statedBudget = !priceMatch ? /\b(?:for|budget of|within)\s*(?:(?:rs\.?|inr|rupees?)\s*)?(\d[\d,.]*)/i.exec(text)?.[1] : null;
  let maxPrice = price !== null && /^(?:under|below|less than|up to|at most|maximum|max)$/.test(comparison) ? price : statedBudget ? Number(statedBudget.replace(/,/g, "")) : null;
  let minPrice = price !== null && /^(?:over|above|more than|greater than|at least|minimum|min)$/.test(comparison) ? price : null;
  const range = text.match(/\bbetween\s*(?:(?:rs\.?|inr|rupees?)\s*)?(\d[\d,.]*)\s*(?:and|to|-)\s*(?:(?:rs\.?|inr|rupees?)\s*)?(\d[\d,.]*)/i);
  if (range) { minPrice = Math.min(Number(range[1].replace(/,/g, "")), Number(range[2].replace(/,/g, ""))); maxPrice = Math.max(Number(range[1].replace(/,/g, "")), Number(range[2].replace(/,/g, ""))); }
  const targetMatch = text.match(/\b(?:around|about|approximately)\s*(?:(?:rs\.?|inr|rupees?)\s*)?(\d[\d,.]*)/i);
  const priceTarget = targetMatch ? Number(targetMatch[1].replace(/,/g, "")) : null;
  const negativeClause = /\b(?:not|no|without|do not want)\b(.+?)(?:\b(?:but|instead|other|except)\b|$)/i.exec(text)?.[1] || "";
  const excludedColors = COLOR_WORDS.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(negativeClause));
  const colors = COLOR_WORDS.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(text) && !excludedColors.includes(color));
  if (colors.includes("blue") && !colors.includes("navy")) colors.push("navy");
  const sizeAlternatives = [...SIZE_WORDS].sort((left, right) => right.length - left.length).join("|");
  const namedSize = new RegExp(`\\b(?:size|in|available in|comes in)\\s+(${sizeAlternatives})\\b|\\b(${sizeAlternatives})\\s+(?:size|t shirt|shirt|tee|hoodie|pants)\\b`, "i").exec(text);
  const rawSize = (namedSize?.[1] || namedSize?.[2] || "").toLowerCase();
  const size = rawSize === "small" ? "s" : rawSize === "medium" ? "m" : rawSize === "large" ? "l" : rawSize === "extra large" ? "xl" : rawSize;
  const numericSize = /\bsize\s*(\d{1,2})\b/i.exec(text)?.[1] || "";
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
  const sort = /\b(?:most expensive|priciest|highest price|costliest)\b/i.test(text) ? "price-desc"
    : /\b(?:cheapest|cheepest|lowest price|least expensive)\b/i.test(text) ? "price-asc"
      : /\b(?:best selling|bestseller|best seller|most popular)\b/i.test(text) ? "best-selling" : "relevance";
  const brandMatch = text.match(/\b(?:brand|company|from|by)\s+([a-z0-9][a-z0-9&' -]{1,35}?)(?=\s+(?:in|with|under|below|less|over|above|more|price|cost|for|size|color|colour)\b|[,?.]|$)/i);
  return { colors, excludedColors, size: numericSize || size, brand: brandMatch?.[1]?.trim() || (text.includes("titan") ? "Titan" : ""), minPrice, maxPrice, priceTarget, availability: /\b(?:in stock|available|available now)\b/i.test(text) ? "available" : /\b(?:out of stock|unavailable)\b/i.test(text) ? "unavailable" : "", productType, features, excludeFeatures, sort };
}

export function productRelevance(product, phrase) {
  const terms = [...new Set(normalizeProductLookup(phrase).split(/\s+/).filter((term) => term.length > 1))];
  if (!terms.length) return 0;
  const fields = [product.title, product.handle, product.description, product.vendor, product.productType, ...(product.tags || []), ...(product.collections || []).flatMap((collection) => [collection.title, collection.handle]), ...(product.metafields || []).map((field) => `${field.namespace} ${field.key} ${field.value}`), ...(product.variants || []).flatMap((variant) => [variant.title, variant.sku, variant.price, ...(variant.selectedOptions || []).map((option) => option.value)])];
  const haystack = normalizeProductLookup(fields.join(" "));
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

export function productMatchesFilters(product, filters) {
  const title = normalizeProductLookup(product.title);
  const fields = normalizeProductLookup([product.title, product.vendor, product.productType, ...(product.tags || []), ...(product.collections || []).flatMap((item) => [item.title, item.handle]), ...(product.metafields || []).map((field) => `${field.namespace} ${field.key} ${field.value}`), ...(product.variants || []).flatMap((variant) => [variant.title, ...(variant.selectedOptions || []).map((option) => option.value)])].join(" "));
  if (filters.colors?.length && !filters.colors.some((color) => color === "blue" ? /\b(?:blue|navy)\b/.test(fields) : fields.split(" ").includes(color))) return false;
  if (filters.excludedColors?.some((color) => fields.split(" ").includes(color) || (color === "blue" && /\bnavy\b/.test(fields)))) return false;
  if (filters.brand && !fields.includes(normalizeProductLookup(filters.brand)) && !normalizeProductLookup(product.vendor).includes(normalizeProductLookup(filters.brand))) return false;
  if (filters.productType && !(filters.productType === "shirt" ? /\b(?:t shirt|shirt|tee)\b/.test(title) : title.includes(filters.productType))) return false;
  if (filters.features?.some((feature) => !fields.includes(normalizeProductLookup(feature)))) return false;
  if (filters.excludeFeatures?.some((feature) => fields.includes(normalizeProductLookup(feature)))) return false;
  const prices = (product.variants || []).filter((variant) => variant.availableForSale !== false && variant.price !== undefined).map((variant) => Number(variant.price)).filter(Number.isFinite);
  if (filters.minPrice !== null && filters.minPrice !== undefined && (!prices.length || !prices.some((price) => price >= filters.minPrice))) return false;
  if (filters.maxPrice !== null && filters.maxPrice !== undefined && (!prices.length || !prices.some((price) => price < filters.maxPrice))) return false;
  if (filters.priceTarget !== null && filters.priceTarget !== undefined && (!prices.length || !prices.some((price) => Math.abs(price - filters.priceTarget) <= Math.max(50, filters.priceTarget * 0.15)))) return false;
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
