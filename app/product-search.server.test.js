import assert from "node:assert/strict";
import test from "node:test";
import { extractProductFilters, normalizeProductLookup, productMatchesFilters, productSearchPhrase } from "./product-search.server.js";

const catalog = [
  { title: "Everyday Navy T-Shirt", productType: "T-Shirts", tags: [], variants: [{ title: "Medium", price: "449.00", availableForSale: true, selectedOptions: [{ name: "Size", value: "M" }] }] },
  { title: "Navy Stripe Weekend T-Shirt", productType: "T-Shirts", tags: [], variants: [{ title: "Large", price: "699.00", availableForSale: true, selectedOptions: [{ name: "Size", value: "L" }] }] },
  { title: "Sky Blue Crew Neck T-Shirt", productType: "T-Shirts", tags: [], variants: [{ title: "Large", price: "449.00", availableForSale: true, selectedOptions: [{ name: "Size", value: "L" }] }] },
  { title: "Daily Heather Grey T-Shirt", productType: "T-Shirts", tags: [], variants: [{ title: "Default Title", price: "399.00", availableForSale: true, selectedOptions: [] }] },
  { title: "Forest Green Pocket T-Shirt", productType: "T-Shirts", tags: [], variants: [{ title: "Large", price: "549.00", availableForSale: true, selectedOptions: [{ name: "Size", value: "L" }] }] },
  { title: "Essential Black Crew Neck T-Shirt", productType: "T-Shirts", tags: ["bestseller"], variants: [{ title: "Small", price: "399.00", availableForSale: true, selectedOptions: [{ name: "Size", value: "S" }] }] },
  { title: "Relaxed Olive Oversized T-Shirt", productType: "T-Shirts", tags: [], variants: [{ title: "Large", price: "599.00", availableForSale: true, selectedOptions: [{ name: "Size", value: "L" }] }] },
  { title: "Classic Beige Chino Pants", productType: "Pants", tags: [], variants: [{ title: "Default Title", price: "1099.00", availableForSale: true, selectedOptions: [] }] },
  { title: "The Complete Snowboard", productType: "Snowboards", tags: [], variants: [{ title: "Default Title", price: "699.95", availableForSale: true, selectedOptions: [] }] },
  { title: "Weekend Light Blue Jeans", productType: "Pants", tags: [], variants: [{ title: "Default Title", price: "1499.00", availableForSale: true, selectedOptions: [] }] },
];

test("normalizes common spelling, spacing, and color variants", () => {
  assert.equal(normalizeProductLookup("tshirt"), normalizeProductLookup("T-Shirt"));
  assert.equal(normalizeProductLookup("tshert"), normalizeProductLookup("tee"));
  assert.equal(normalizeProductLookup("gray"), normalizeProductLookup("grey"));
  assert.equal(normalizeProductLookup("skyblue"), normalizeProductLookup("sky blue"));
  assert.match(productSearchPhrase("তোমাদের দোকানে কালো টি-শার্ট আছে?"), /black.*t shirt|t shirt.*black/);
  assert.match(productSearchPhrase("show tees below Rs 400"), /t shirt/);
  assert.doesNotMatch(productSearchPhrase("show tees below Rs 400"), /400|rs/i);
  assert.doesNotMatch(productSearchPhrase("What is the cheapest tee in the featured products?"), /featured/i);
});

test("keeps use-case meaning while removing conversational filler", () => {
  const purposeQuery = productSearchPhrase("I need something waterproof that will be suitable to use for running in the rain");
  assert.match(purposeQuery, /waterproof/);
  assert.match(purposeQuery, /running/);
  assert.match(purposeQuery, /rain/);
  assert.equal(productSearchPhrase("Can you help me find something good?"), "");
  assert.equal(productSearchPhrase("I am not sure what to buy. Can you suggest something?"), "");
  assert.match(productSearchPhrase("I want something comfortable for travelling"), /comfortable.*travelling/);
});

test("extracts budget without mistaking the amount for a clothing size", () => {
  const under350 = extractProductFilters("black t-shirt for 350");
  assert.equal(under350.size, "");
  assert.equal(under350.productType, "shirt");
  assert.equal(under350.maxPrice, 350);
  assert.equal(productMatchesFilters(catalog[0], under350), false);
  const budget = extractProductFilters("tees under Rs 400");
  assert.equal(budget.maxPrice, 400);
  assert.equal(budget.size, "");
  assert.equal(productMatchesFilters(catalog[3], budget), true);
  assert.equal(productMatchesFilters(catalog[0], budget), false);
  assert.equal(extractProductFilters("tee for Rs 350").maxPrice, 350);
  assert.equal(extractProductFilters("medium budget tee").size, "");
});

test("under, approximate price, and requested size are applied to variants", () => {
  assert.equal(extractProductFilters("tee under 350").maxPrice, 350);
  assert.equal(extractProductFilters("black pants under ₹1,500").maxPrice, 1500);
  assert.equal(extractProductFilters("show products under ₹700").maxPrice, 700);
  assert.equal(extractProductFilters("tee around Rs 700").priceTarget, 700);
  assert.equal(productMatchesFilters(catalog[2], extractProductFilters("blue tee in size L")), true);
  assert.equal(productMatchesFilters(catalog[2], extractProductFilters("blue tee, size large")), true);
  assert.equal(productMatchesFilters(catalog[0], extractProductFilters("blue tee in size L")), false);
  assert.equal(extractProductFilters("What sizes does the navy tee come in?").size, "");
  assert.equal(extractProductFilters("Show the navy tee in size small").size, "s");
});

test("filters the requested apparel type and descriptive attributes", () => {
  assert.equal(productMatchesFilters(catalog[0], extractProductFilters("navy t-shirt")), true);
  assert.equal(productMatchesFilters(catalog[0], extractProductFilters("blue t-shirt")), false);
  assert.equal(productMatchesFilters(catalog[0], extractProductFilters("navy t-shirt")), true);
  assert.equal(productMatchesFilters(catalog[7], extractProductFilters("navy t-shirt")), false);
  assert.equal(productMatchesFilters(catalog[8], extractProductFilters("best selling t-shirt")), false);
  assert.equal(productMatchesFilters(catalog[9], extractProductFilters("blue jeans")), true);
  assert.equal(productMatchesFilters(catalog[1], extractProductFilters("navy tee without stripes")), false);
  assert.equal(productMatchesFilters(catalog[0], extractProductFilters("navy tee without stripes")), true);
  assert.equal(productMatchesFilters(catalog[3], extractProductFilters("grey tee")), true);
  assert.equal(productMatchesFilters(catalog[0], extractProductFilters("t-shirt not black or white")), true);
  assert.equal(productMatchesFilters(catalog[5], extractProductFilters("t-shirt not black or white")), false);
  assert.equal(productMatchesFilters(catalog[4], extractProductFilters("t-shirt not black or white")), true);
  assert.equal(productMatchesFilters(catalog[0], extractProductFilters("hoodie")), false);
});

test("recognizes price ranking requests", () => {
  assert.equal(extractProductFilters("cheepest t-shirt").sort, "price-asc");
  assert.equal(extractProductFilters("most expensive tee").sort, "price-desc");
  assert.equal(extractProductFilters("best selling tshirt").sort, "best-selling");
});
