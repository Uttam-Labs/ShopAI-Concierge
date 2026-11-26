import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONVERSATION_FLOWS, normalizeConversationFlows, resolveConversationFlow } from "./flows.server.js";

test("order cancellation is registered as its own default flow", () => {
  assert.deepEqual(DEFAULT_CONVERSATION_FLOWS.map((flow) => flow.id), [
    "welcome",
    "product-discovery",
    "order-updates",
    "returns-support",
    "order-cancellation",
  ]);
  assert.equal(normalizeConversationFlows([]).find((flow) => flow.id === "order-cancellation")?.steps[0].id, "start");
});

test("natural cancellation requests route into cancellation from a fresh chat or return flow", () => {
  for (const message of ["I want to cancel my order", "I'd like to cancel an order"]) {
    for (const context of [{}, { flowId: "returns-support", stepId: "return-details" }]) {
      const result = resolveConversationFlow([], { message, ...context });
      assert.equal(result?.flow?.id, "order-cancellation", message);
      assert.equal(result?.flow?.stepId, "start", message);
    }
  }
});

test("order number and choice data survive cancellation flow transitions", () => {
  const orderNumberStep = resolveConversationFlow([], {
    message: "1001",
    flowId: "order-cancellation",
    stepId: "start",
  });
  assert.equal(orderNumberStep?.flow?.stepId, "order-email");
  assert.equal(orderNumberStep?.flow?.data.orderNumber, "1001");

  const scopeStep = resolveConversationFlow([], {
    message: "Skip reason",
    flowId: "order-cancellation",
    stepId: "reason",
    choiceId: "skip-reason",
    flowData: { orderNumber: "1001", orderEmail: "shopper@example.com" },
  });
  assert.equal(scopeStep?.flow?.stepId, "scope");
  assert.equal(scopeStep?.flow?.data.orderNumber, "1001");
  assert.equal(scopeStep?.flow?.data.orderEmail, "shopper@example.com");
  assert.equal(scopeStep?.flow?.data.reason, "Not provided");
});

test("return and tracking requests still route to their own flows", () => {
  assert.equal(resolveConversationFlow([], { message: "I want to return a product" })?.flow?.id, "returns-support");
  assert.equal(resolveConversationFlow([], { message: "I want to track my order" })?.action, "openOrderTracking");
});
