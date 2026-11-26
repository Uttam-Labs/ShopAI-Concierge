import assert from "node:assert/strict";
import test from "node:test";
import { filterKnowledgeForIntent, isPolicyIntent, isSupportEscalationIntent, isSupportRequestIntent, resolveRetrievalQuestion } from "./chat-intents.server.js";

test("customer wording keeps policy questions separate from previous product searches", () => {
  const question = "if it doesn't fit can i send it back?";
  assert.equal(isPolicyIntent(question), true);
  assert.equal(resolveRetrievalQuestion(question, "got any black tee under 500?", true), question);
  assert.equal(isPolicyIntent("got any black tee under 500?"), false);
  assert.equal(isPolicyIntent("does this shirt fit loose?"), false);
  const sources = filterKnowledgeForIntent([
    { source_type: "product", title: "Black tee" },
    { source_type: "policy", title: "Returns policy" },
  ], true);
  assert.deepEqual(sources.map((source) => source.title), ["Returns policy"]);
});

test("natural requests to talk to a person open support without submitting a ticket", () => {
  for (const question of [
    "I want to contact store support about a damaged item",
    "I need to speak to someone because my parcel arrived damaged",
    "Can I talk to a real person?",
    "I need customer support",
  ]) assert.equal(isSupportRequestIntent(question), true, question);
  assert.equal(isSupportRequestIntent("need a nice gift for my brother"), false);
  assert.equal(isSupportEscalationIntent("my parcel arrived damaged"), true);
  assert.equal(isSupportEscalationIntent("what is your return policy"), false);
});

test("ordinary follow-up questions retain the preceding customer context", () => {
  assert.equal(resolveRetrievalQuestion("what about in navy?", "show me casual tees", true), "show me casual tees\nwhat about in navy?");
});
