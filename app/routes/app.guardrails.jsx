/* eslint-disable react/prop-types */
import { useRef, useState } from "react";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import { useActionToast } from "../components/AdminToast";
import { DEFAULT_GUARDRAILS, normalizeGuardrails } from "../guardrails.server";

const parseGuardrails = (value) => {
  try { return JSON.parse(String(value || "[]")); } catch { return null; }
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const prisma = (await import("../db.server.js")).default;
  const settings = await prisma.assistantSettings.findUnique({ where: { shop: session.shop }, select: { guardrails: true } });
  return { guardrails: normalizeGuardrails(settings?.guardrails ?? DEFAULT_GUARDRAILS) };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const submitted = parseGuardrails(form.get("guardrails"));
  if (!Array.isArray(submitted)) return { error: "The guardrails could not be read. Please try again." };
  const guardrails = normalizeGuardrails(submitted);
  const prisma = (await import("../db.server.js")).default;
  try {
    await prisma.assistantSettings.upsert({ where: { shop: session.shop }, create: { shop: session.shop, guardrails }, update: { guardrails } });
    return { saved: true };
  } catch (error) {
    console.error("Guardrails save failed", error);
    return { error: "Guardrails couldn’t be saved. Please try again." };
  }
};

export default function GuardrailsPage({ loaderData }) {
  const fetcher = useFetcher();
  useActionToast(fetcher);
  const formRef = useRef(null);
  const [guardrails, setGuardrails] = useState(loaderData.guardrails);
  const saving = fetcher.state !== "idle";
  const customCount = guardrails.filter((rule) => !rule.standard).length;
  const enabledCount = guardrails.filter((rule) => rule.enabled).length;
  const hasIncompleteRule = guardrails.some((rule) => !rule.title.trim() || !rule.phrases.some((phrase) => phrase.trim()) || !rule.response.trim());
  const update = (id, changes) => setGuardrails((current) => current.map((rule) => rule.id === id ? { ...rule, ...changes } : rule));
  const addGuardrail = () => setGuardrails((current) => [...current, {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "New guardrail",
    phrases: ["add a phrase that should trigger this rule"],
    response: "Add the response shoppers should receive when this rule applies.",
    enabled: true,
    standard: false,
  }]);
  const removeGuardrail = (id) => setGuardrails((current) => current.filter((rule) => rule.id !== id || rule.standard));

  return <s-page heading="Guardrails" inlineSize="large">
    <s-button slot="primary-action" variant="primary" disabled={saving || hasIncompleteRule} onClick={() => formRef.current?.requestSubmit()}><AdminIcon name="save"/>{saving ? "Saving guardrails…" : "Save guardrails"}</s-button>
    <AdminPageHeader title="Guardrails" description="Set clear boundaries for your concierge. Matching rules are checked before it handles a shopper message." metrics={[{ label: "Rules", value: guardrails.length }, { label: "Active", value: enabledCount }, { label: "Custom", value: customCount }]} />
    <fetcher.Form ref={formRef} method="post" className="guardrails-form">
      <input type="hidden" name="guardrails" value={JSON.stringify(guardrails)} />
      <section className="guardrails-intro">
        <div className="guardrails-intro-icon"><AdminIcon name="warning" size={20}/></div>
        <div><strong>Checked first in live chat</strong><p>If a shopper’s message matches an active trigger phrase, the concierge sends that rule’s response immediately. If no rule matches, the message continues through the normal FAQ, flow, order, and knowledge steps.</p></div>
        <span className="guardrails-live-badge"><i/> Live</span>
      </section>
      <div className="guardrails-list-heading"><div><span className="settings-section-kicker">RESPONSE RULES</span><h2>Your guardrails</h2><p>Enter one or more trigger phrases. Any matching phrase activates the response.</p></div><button className="admin-cta" type="button" disabled={guardrails.length >= 50} onClick={addGuardrail}><AdminIcon name="plus"/> Add guardrail</button></div>
      <div className="guardrails-grid">{guardrails.map((rule, index) => <article className={`guardrail-card ${rule.standard ? "is-standard" : ""} ${rule.enabled ? "" : "is-disabled"}`} key={rule.id}>
        <header className="guardrail-card-header"><span className="guardrail-index">{String(index + 1).padStart(2, "0")}</span><div className="guardrail-header-copy"><span className="settings-section-kicker">{rule.standard ? "STANDARD PROTECTION" : "CUSTOM RULE"}</span><strong>{rule.enabled ? "Active rule" : "Paused rule"}</strong></div>{rule.standard ? <span className="guardrail-protected"><AdminIcon name="check" size={13}/> Always on</span> : <><label className="guardrail-toggle"><input type="checkbox" checked={rule.enabled} onChange={(event) => update(rule.id, { enabled: event.target.checked })}/><span>{rule.enabled ? "Active" : "Paused"}</span></label><button className="faq-icon-button danger" type="button" aria-label={`Delete ${rule.title}`} title="Delete guardrail" onClick={() => removeGuardrail(rule.id)}><AdminIcon name="trash"/></button></>}</header>
        <div className="guardrail-fields"><label className="settings-field">Guardrail name<input className="admin-text-input" maxLength={120} value={rule.title} onChange={(event) => update(rule.id, { title: event.target.value })} placeholder="e.g. Keep customer data private"/></label><label className="settings-field">When should this rule apply?<textarea className="admin-text-input guardrail-trigger-input" value={rule.phrases.join("\n")} onChange={(event) => update(rule.id, { phrases: event.target.value.split(/[\n,]+/).map((phrase) => phrase.trim()).filter(Boolean).slice(0, 40) })} placeholder={"Enter trigger phrases, one per line\nExample: someone else’s order"}/><small>Any phrase here can trigger this rule. Separate phrases with a new line.</small></label><label className="settings-field">Response to the shopper<textarea className="admin-text-input guardrail-response-input" maxLength={2000} value={rule.response} onChange={(event) => update(rule.id, { response: event.target.value })} placeholder="Write the exact, helpful response the concierge should send."/><small>This reply is sent as written, without an AI-generated answer.</small></label></div>
        <div className="guardrail-preview"><span className="guardrail-preview-label"><AdminIcon name="chat" size={13}/> CUSTOMER REPLY</span><p>{rule.response || "Your response preview will appear here."}</p></div>
      </article>)}</div>
      <footer className="guardrails-footer"><div><span>Standard protections stay enabled. You can pause or remove your custom rules at any time.</span>{hasIncompleteRule && <small className="guardrails-validation" role="alert">Each rule needs a name, at least one trigger phrase, and a response.</small>}</div><button className="admin-cta" type="button" disabled={saving || hasIncompleteRule} onClick={() => formRef.current?.requestSubmit()}><AdminIcon name="save"/>{saving ? "Saving…" : "Save guardrails"}</button></footer>
    </fetcher.Form>
  </s-page>;
}

export const headers = (args) => boundary.headers(args);
