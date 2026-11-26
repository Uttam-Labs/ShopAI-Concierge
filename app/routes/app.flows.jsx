/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import { useActionToast } from "../components/AdminToast";
import { DEFAULT_CONVERSATION_FLOWS, normalizeConversationFlows } from "../flows.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const prisma = (await import("../db.server.js")).default;
  const settings = await prisma.assistantSettings.findUnique({ where: { shop: session.shop }, select: { flows: true } });
  return { flows: normalizeConversationFlows(settings?.flows) };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  if (form.get("intent") !== "saveFlows") return { error: "That flow action is not available." };
  let parsed;
  try { parsed = JSON.parse(String(form.get("flows") || "[]")); }
  catch { return { error: "Review the flow changes and try saving again." }; }
  if (!Array.isArray(parsed) || parsed.length !== DEFAULT_CONVERSATION_FLOWS.length) return { error: "The built-in flow list could not be verified. Refresh the page and try again." };
  const flows = normalizeConversationFlows(parsed);
  try {
    const prisma = (await import("../db.server.js")).default;
    await prisma.assistantSettings.upsert({ where: { shop: session.shop }, create: { shop: session.shop, flows }, update: { flows } });
    return { saved: true, flows };
  } catch (error) {
    console.error("Conversation flows save failed", error);
    return { error: "We couldn’t save the conversation flows. Please try again." };
  }
};

export default function Flows({ loaderData }) {
  const fetcher = useFetcher();
  useActionToast(fetcher);
  const [flows, setFlows] = useState(loaderData.flows);
  const [selectedId, setSelectedId] = useState(loaderData.flows[0]?.id || "welcome");
  const [showGraph, setShowGraph] = useState(false);
  useEffect(() => { if (fetcher.data?.saved) setFlows(fetcher.data.flows); }, [fetcher.data]);
  const selectedIndex = flows.findIndex((flow) => flow.id === selectedId);
  const selected = flows[selectedIndex] || flows[0];
  const updateFlow = (updater) => setFlows((current) => current.map((flow, index) => index === selectedIndex ? updater(flow) : flow));
  const updateStep = (stepId, updater) => updateFlow((flow) => ({ ...flow, steps: flow.steps.map((step) => step.id === stepId ? updater(step) : step) }));
  const updateChoice = (stepId, choiceId, updater) => updateStep(stepId, (step) => ({ ...step, choices: step.choices.map((choice) => choice.id === choiceId ? updater(choice) : choice) }));
  const activeCount = flows.filter((flow) => flow.enabled).length;
  const saveForm = <fetcher.Form method="post" className="flow-save-form"><input type="hidden" name="intent" value="saveFlows"/><input type="hidden" name="flows" value={JSON.stringify(flows)}/><button className="admin-cta" type="submit" disabled={fetcher.state !== "idle"}><AdminIcon name="save"/>{fetcher.state !== "idle" ? "Saving flows…" : "Save flow changes"}</button></fetcher.Form>;

  return <s-page heading="Flows" inlineSize="large">
    <AdminPageHeader title="Conversation flows" description="Set up guided paths for greetings, product discovery, order updates, and support. Enabled flows run first; other questions continue to your store knowledge and AI." metrics={[{ label: "Built-in flows", value: flows.length }, { label: "Enabled", value: activeCount }, { label: "AI fallback", value: "On" }]}/>
    <section className="flow-workspace">
      <aside className="flow-library-panel" aria-label="Built-in flow list">
        <header className="flow-library-heading"><span className="faq-section-icon"><AdminIcon name="list"/></span><div><span className="rag-eyebrow">BUILT-IN FLOWS</span><h2>Flow library</h2><p>Choose a flow to edit</p></div></header>
        <div className="flow-library-list">{flows.map((flow) => <div className="flow-library-entry" key={flow.id}><button className={`flow-library-item ${flow.id === selected?.id ? "selected" : ""}`} type="button" onClick={() => setSelectedId(flow.id)} aria-pressed={flow.id === selected?.id}><span className="flow-library-icon"><AdminIcon name={flow.id === "order-updates" ? "list" : flow.id === "returns-support" ? "ticket" : flow.id === "product-discovery" ? "search" : "chat"}/></span><span className="flow-library-copy"><strong>{flow.name}</strong><small>{flow.steps.length} guided step{flow.steps.length === 1 ? "" : "s"}</small></span><span className={`flow-enabled-pill ${flow.enabled ? "active" : ""}`}>{flow.enabled ? "On" : "Off"}</span></button><button className="flow-library-graph-button" type="button" onClick={() => { setSelectedId(flow.id); setShowGraph(true); }} aria-label={`View ${flow.name} graph`} title="View flow graph"><AdminIcon name="list"/><span>Graph</span></button></div>)}</div>
        <div className="flow-library-note"><AdminIcon name="info"/><p>These templates are fixed. You can customize their wording and turn them on or off, but can’t add or remove flows.</p></div>
      </aside>

      {selected && <section className="flow-editor-panel" aria-label={`${selected.name} editor`}>
        <header className="flow-editor-heading"><div><span className="rag-eyebrow">FLOW SETTINGS</span><h2>{selected.name}</h2><p>{selected.description}</p></div><label className="flow-toggle" htmlFor={`flow-${selected.id}-enabled`}><input id={`flow-${selected.id}-enabled`} type="checkbox" checked={selected.enabled} aria-label="Enable this flow" onChange={(event) => updateFlow((flow) => ({ ...flow, enabled: event.target.checked }))}/><span className="flow-toggle-track"/><span><strong>{selected.enabled ? "Enabled" : "Disabled"}</strong><small>{selected.enabled ? "Available in storefront chat" : "Hidden from shoppers"}</small></span></label></header>

        <div className="flow-editor-fields"><label className="admin-field">Flow name<input className="admin-text-input" maxLength={80} value={selected.name} onChange={(event) => updateFlow((flow) => ({ ...flow, name: event.target.value }))}/></label><label className="admin-field">What this flow does<input className="admin-text-input" maxLength={220} value={selected.description} onChange={(event) => updateFlow((flow) => ({ ...flow, description: event.target.value }))}/></label><label className="admin-field flow-trigger-field">Trigger phrases<textarea className="admin-text-input admin-textarea" rows={3} value={selected.triggerTerms.join("\n")} onChange={(event) => updateFlow((flow) => ({ ...flow, triggerTerms: event.target.value.split("\n").map((term) => term.trim()).filter(Boolean).slice(0, 30) }))}/><small>One phrase per line. Matching ignores letter case and punctuation.</small></label></div>

        <div className="flow-steps-heading"><div><span className="flow-section-number">01</span><div><h3>Guided conversation</h3><p>Edit what customers see at each step.</p></div></div><button className="flow-graph-toggle" type="button" aria-expanded={showGraph} onClick={() => setShowGraph((open) => !open)}><AdminIcon name="list"/>{showGraph ? "Hide flow graph" : "View selected flow graph"}</button></div>
        {showGraph && <FlowGraph flow={selected}/>}
        <div className="flow-step-list">{selected.steps.map((step, stepIndex) => <article className="flow-step-card" key={step.id}><header><span className="flow-step-number">{String(stepIndex + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><small>{step.choices?.length ? `${step.choices.length} customer choices` : step.inputAction === "continueAI" ? "Collects a product search brief" : step.inputAction === "openSupport" ? "Collects a support request detail" : "Conversation ending"}</small></div></header><label className="admin-field">Message<textarea className="admin-text-input admin-textarea flow-message-input" rows={3} maxLength={1000} value={step.prompt} onChange={(event) => updateStep(step.id, (item) => ({ ...item, prompt: event.target.value }))}/></label>{step.inputReply && <label className="admin-field flow-input-reply-field">Reply after the customer responds<textarea className="admin-text-input admin-textarea" rows={2} maxLength={500} value={step.inputReply} onChange={(event) => updateStep(step.id, (item) => ({ ...item, inputReply: event.target.value }))}/></label>}{step.choices?.length > 0 && <div className="flow-choices-editor"><div className="flow-choices-heading"><strong>Customer choices</strong><span>The existing branch for each choice is kept intact.</span></div>{step.choices.map((choice) => { const target = choice.nextStepId ? selected.steps.find((item) => item.id === choice.nextStepId)?.title : choice.action === "openOrderTracking" ? "Secure order lookup" : choice.action === "openSupport" ? "Support request form" : "AI product search"; return <div className="flow-choice-editor-row" key={choice.id}><label className="flow-choice-row"><span className="flow-choice-marker">↳</span><input className="admin-text-input" aria-label={`${step.title}: customer choice`} maxLength={100} value={choice.label} onChange={(event) => updateChoice(step.id, choice.id, (entry) => ({ ...entry, label: event.target.value }))}/><span className="flow-choice-target"><AdminIcon name={choice.action ? "arrow" : "arrow-right"}/>{target || "Next step"}</span></label>{choice.reply && <label className="flow-choice-reply-label">Reply after this choice<textarea className="admin-text-input" rows={2} maxLength={500} value={choice.reply} onChange={(event) => updateChoice(step.id, choice.id, (entry) => ({ ...entry, reply: event.target.value }))}/></label>}</div>; })}</div>}</article>)}</div>
        <footer className="flow-editor-footer"><span><AdminIcon name="info"/> Changes apply to future customer messages. Other questions keep using RAG and AI.</span>{saveForm}</footer>
      </section>}
    </section>
  </s-page>;
}

function FlowGraph({ flow }) {
  const steps = flow.steps || [];
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  return <section className="flow-graph" aria-label={`${flow.name} conversation graph`}>
    <header><span className="flow-graph-start">START</span><div><strong>{flow.name}</strong><small>{flow.enabled ? "Enabled storefront flow" : "Disabled flow preview"} · {flow.triggerTerms.length} trigger phrases</small></div></header>
    <div className="flow-graph-steps">
      {steps.map((step, index) => <article className="flow-graph-node" key={step.id}>
        {index > 0 && <span className="flow-graph-connector" aria-hidden="true"/>}
        <div className="flow-graph-node-head"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><small>{step.prompt}</small></div></div>
        {step.choices?.length > 0 ? <div className="flow-graph-branches">{step.choices.map((choice) => {
          const target = choice.nextStepId ? stepMap.get(choice.nextStepId)?.title || choice.nextStepId : choice.action === "openSupport" ? "Support ticket form" : choice.action === "openOrderTracking" ? "Verified order lookup" : choice.action === "continueAI" ? "Store catalog search" : "Continue conversation";
          return <div className="flow-graph-branch" key={choice.id}><span className="flow-graph-branch-dot"/><strong>{choice.label}</strong><span className="flow-graph-arrow">→</span><small>{target}</small></div>;
        })}</div> : <div className="flow-graph-terminal">{step.inputAction === "continueAI" ? "Customer reply → Store catalog search" : step.inputAction === "openSupport" ? `Customer reply → Support ticket${step.followupStepId ? ` → ${stepMap.get(step.followupStepId)?.title || step.followupStepId}` : ""}` : "Conversation ends here"}</div>}
        {step.routes?.length > 0 && <div className="flow-graph-routes">{step.routes.map((route) => <span key={`${step.id}-${route.nextStepId}`}>{route.keywords.slice(0, 3).join(" / ")} → {stepMap.get(route.nextStepId)?.title || route.nextStepId}</span>)}</div>}
      </article>)}
    </div>
  </section>;
}

export const headers = (args) => boundary.headers(args);
