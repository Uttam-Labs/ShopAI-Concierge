/* eslint-disable react/prop-types */
/* eslint-env node */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AdminPageHeader, { AdminIcon } from "../components/AdminPageHeader";
import { useActionToast } from "../components/AdminToast";
import { embedTexts } from "../gemini.server";
import { resolveEmbeddingKey } from "../ai.server";
import { createSupabaseServerClient, getSupabaseServerConfigIssues } from "../supabase.server";
import { DEFAULT_CONVERSATION_FLOWS, normalizeConversationFlows } from "../flows.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const prisma = (await import("../db.server.js")).default;
  const settings = await prisma.assistantSettings.findUnique({ where: { shop: session.shop }, select: { flows: true } });
  return { flows: normalizeConversationFlows(settings?.flows) };
};

function flowKnowledgeText(flow) {
  const sections = [`Conversation flow: ${flow.name}`, `Purpose: ${flow.description}`, `Flow status: ${flow.enabled ? "enabled" : "disabled"}`, `Customer trigger phrases: ${flow.triggerTerms.join(", ")}`];
  for (const [index, step] of flow.steps.entries()) {
    sections.push(`Step ${index + 1}: ${step.title}\nAssistant says: ${step.prompt}`);
    for (const choice of step.choices || []) sections.push(`Customer selects: ${choice.label}\nAssistant replies: ${choice.reply || "Continue to the next step."}\nNext event: ${choice.action || (choice.nextFlowId ? `start ${choice.nextFlowId} flow` : choice.nextStepId ? `continue to ${choice.nextStepId}` : "continue conversation")}`);
    for (const route of step.routes || []) sections.push(`Customer may say: ${route.keywords.join(", ")}\nAssistant replies: ${route.reply || "Use the next guided step."}\nNext event: ${route.action || (route.nextFlowId ? `start ${route.nextFlowId} flow` : route.nextStepId ? `continue to ${route.nextStepId}` : "continue to store knowledge search")}`);
  }
  return sections.join("\n\n");
}

async function indexFlowKnowledge(shop, flows, assistantSettings) {
  const embeddingKey = resolveEmbeddingKey(assistantSettings);
  const setupIssues = getSupabaseServerConfigIssues();
  if (!embeddingKey || setupIssues.length) {
    const missing = [...(!embeddingKey ? [assistantSettings?.aiProvider === "gemini" ? "connect Google Gemini in Assistant settings" : "add GEMINI_API_KEY to the app environment"] : []), ...setupIssues];
    return { indexed: false, indexingWarning: `Your flow changes are saved. Add the missing vector search setup (${missing.join(", ")}), then save the flows again to index them.` };
  }
  try {
    const activeFlows = flows.filter((flow) => flow.enabled);
    const texts = activeFlows.map(flowKnowledgeText);
    const embeddings = texts.length ? await embedTexts(texts, "RETRIEVAL_DOCUMENT", embeddingKey) : [];
    const rows = activeFlows.map((flow, index) => ({
      source_type: "flow",
      source_id: flow.id,
      title: `Conversation flow: ${flow.name}`,
      content: texts[index],
      metadata: { flow_id: flow.id, embedding_model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001" },
      shop_domain: shop,
      embedding: embeddings[index],
    }));
    const supabase = createSupabaseServerClient();
    if (rows.length) {
      const { error } = await supabase.from("shopai_knowledge").upsert(rows, { onConflict: "shop_domain,source_type,source_id" });
      if (error) throw error;
    }
    const { data: existing, error: readError } = await supabase.from("shopai_knowledge").select("id,source_id").eq("shop_domain", shop).eq("source_type", "flow");
    if (readError) throw readError;
    const activeIds = new Set(activeFlows.map((flow) => flow.id));
    const staleIds = (existing || []).filter((row) => !activeIds.has(row.source_id)).map((row) => row.id);
    for (let offset = 0; offset < staleIds.length; offset += 500) {
      const { error } = await supabase.from("shopai_knowledge").delete().eq("shop_domain", shop).in("id", staleIds.slice(offset, offset + 500));
      if (error) throw error;
    }
    return { indexed: true, indexedCount: rows.length };
  } catch (error) {
    console.error("Conversation flow vector indexing failed", { shop, message: error?.message });
    if (String(error?.code || "") === "23514") return { indexed: false, indexingWarning: "Your flow changes are saved. Apply the new conversation-flow knowledge migration in Supabase, then save the flows again to index them." };
    return { indexed: false, indexingWarning: "Your flow changes are saved, but vector indexing did not finish. Check the Gemini and Supabase setup, then save the flows again." };
  }
}

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
    const assistantSettings = await prisma.assistantSettings.findUnique({ where: { shop: session.shop }, select: { aiProvider: true, aiApiKeyEncrypted: true } });
    const indexResult = await indexFlowKnowledge(session.shop, flows, assistantSettings);
    return { saved: true, flows, ...indexResult };
  } catch (error) {
    console.error("Conversation flows save failed", error);
    return { error: "We couldn’t save the conversation flows. Please try again." };
  }
};

export default function Flows({ loaderData }) {
  const fetcher = useFetcher();
  useActionToast(fetcher);
  const [flows, setFlows] = useState(loaderData.flows);
  const [selectedFlowId, setSelectedFlowId] = useState(loaderData.flows[0]?.id || "welcome");
  const [selectedNode, setSelectedNode] = useState({ kind: "start" });
  useEffect(() => { if (fetcher.data?.saved) setFlows(fetcher.data.flows); }, [fetcher.data]);
  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) || flows[0];
  const updateFlow = (updater) => setFlows((current) => current.map((flow) => flow.id === selectedFlow.id ? updater(flow) : flow));
  const updateStep = (stepId, updater) => updateFlow((flow) => ({ ...flow, steps: flow.steps.map((step) => step.id === stepId ? updater(step) : step) }));
  const selectedStep = selectedNode.stepId ? selectedFlow.steps.find((step) => step.id === selectedNode.stepId) : null;
  const selectedChoice = selectedNode.kind === "choice" ? selectedStep?.choices?.find((choice) => choice.id === selectedNode.itemId) : null;
  const selectedRoute = selectedNode.kind === "route" ? selectedStep?.routes?.find((route) => route.id === selectedNode.itemId) : null;
  const isSaving = fetcher.state !== "idle";
  const setRoute = (stepId, routeId, updater) => updateStep(stepId, (step) => ({ ...step, routes: (step.routes || []).map((route) => route.id === routeId ? updater(route) : route) }));
  const setChoice = (stepId, choiceId, updater) => updateStep(stepId, (step) => ({ ...step, choices: (step.choices || []).map((choice) => choice.id === choiceId ? updater(choice) : choice) }));
  const branchAction = (branch) => branch.action || (branch.nextFlowId ? "nextFlow" : branch.nextStepId ? "nextStep" : "continueAI");
  const branchActionUpdate = (action) => {
    const nextFlow = action === "nextFlow" ? flows.find((flow) => flow.id !== selectedFlow.id) : null;
    return { action: ["continueAI", "openOrderTracking", "openSupport"].includes(action) ? action : "", nextFlowId: nextFlow?.id || "", nextStepId: action === "nextStep" ? selectedFlow.steps.find((step) => step.id !== selectedNode.stepId)?.id || "" : nextFlow?.steps[0]?.id || "" };
  };
  const updateBranchTargetFlow = (branchKind, stepId, branchId, flowId) => {
    const target = flows.find((flow) => flow.id === flowId);
    const update = (branch) => ({ ...branch, action: "", nextFlowId: flowId, nextStepId: target?.steps[0]?.id || "" });
    if (branchKind === "choice") setChoice(stepId, branchId, update);
    else setRoute(stepId, branchId, update);
  };
  const updateBranchTargetStep = (branchKind, stepId, branchId, targetStepId) => {
    const update = (branch) => ({ ...branch, action: "", nextStepId: targetStepId });
    if (branchKind === "choice") setChoice(stepId, branchId, update);
    else setRoute(stepId, branchId, update);
  };
  const triggerText = selectedFlow.triggerTerms.join(", ");
  const saveButton = <button className="admin-cta" type="submit" disabled={isSaving}><AdminIcon name="save"/>{isSaving ? "Saving and indexing…" : "Save changes"}</button>;

  return <s-page heading="Flows" inlineSize="large">
    <AdminPageHeader title="Conversation flows" description="Map customer messages to helpful replies and actions. Click any node to edit it in the side panel." metrics={[{ label: "Built-in flows", value: flows.length }, { label: "Enabled", value: flows.filter((flow) => flow.enabled).length }, { label: "Vector context", value: "Synced on save" }]}/>
    <section className="flow-studio">
      <aside className="flow-studio-library" aria-label="Flow library">
        <div className="flow-studio-library-heading"><span className="rag-eyebrow">FLOW LIBRARY</span><h2>Choose a flow</h2><p>Built-in flows can be customized and switched on or off.</p></div>
        <div className="flow-studio-flow-list">{flows.map((flow) => <button key={flow.id} type="button" className={`flow-studio-flow-button ${flow.id === selectedFlow.id ? "selected" : ""}`} onClick={() => { setSelectedFlowId(flow.id); setSelectedNode({ kind: "start" }); }}><span className="flow-studio-flow-icon"><AdminIcon name={flow.id === "product-discovery" ? "search" : flow.id === "returns-support" ? "ticket" : flow.id === "order-updates" ? "list" : "chat"}/></span><span><strong>{flow.name}</strong><small>{flow.steps.length} steps · {flow.enabled ? "On" : "Off"}</small></span><span className={`flow-enabled-pill ${flow.enabled ? "active" : ""}`}>{flow.enabled ? "On" : "Off"}</span></button>)}</div>
      </aside>

      <section className={`flow-studio-main ${selectedNode ? "has-inspector" : ""}`}>
        <header className="flow-studio-toolbar"><div><span className="rag-eyebrow">VISUAL FLOW BUILDER</span><h2>{selectedFlow.name}</h2><p>Choose a node to edit its message, matching phrases, and next action.</p></div><label className="flow-toggle" aria-label="Enable this flow"><input type="checkbox" checked={selectedFlow.enabled} onChange={(event) => updateFlow((flow) => ({ ...flow, enabled: event.target.checked }))}/><span className="flow-toggle-track"/><span><strong>{selectedFlow.enabled ? "Enabled" : "Disabled"}</strong><small>{selectedFlow.enabled ? "Available in storefront chat" : "Hidden from shoppers"}</small></span></label></header>
        <div className="flow-studio-body">
          <div className="flow-canvas-wrap">
            <div className="flow-canvas-help"><span>START</span><p>Customer messages matching one of these phrases enter this flow.</p></div>
            <button type="button" className={`flow-canvas-node flow-canvas-start ${selectedNode.kind === "start" ? "active" : ""}`} onClick={() => setSelectedNode({ kind: "start" })}><span className="flow-node-icon"><AdminIcon name="bolt"/></span><span><small>FLOW ENTRY</small><strong>{selectedFlow.name}</strong><em>{selectedFlow.triggerTerms.slice(0, 5).join(", ")}{selectedFlow.triggerTerms.length > 5 ? ` +${selectedFlow.triggerTerms.length - 5} more` : ""}</em></span><span className="flow-node-edit">Edit</span></button>
            <div className="flow-canvas-flowline" aria-hidden="true"/>
            <div className="flow-canvas-steps">{selectedFlow.steps.map((step, stepIndex) => {
              const branches = [...(step.choices || []).map((item) => ({ ...item, kind: "choice" })), ...(step.routes || []).map((item) => ({ ...item, kind: "route" }))];
              const isStepActive = selectedNode.kind === "step" && selectedNode.stepId === step.id;
              return <section className="flow-canvas-step-group" key={step.id}>
                <button type="button" className={`flow-canvas-node flow-canvas-step ${isStepActive ? "active" : ""}`} onClick={() => setSelectedNode({ kind: "step", stepId: step.id })}><span className="flow-node-index">{String(stepIndex + 1).padStart(2, "0")}</span><span><small>{step.inputAction ? "ASSISTANT STEP" : "CONVERSATION STEP"}</small><strong>{step.title}</strong><em>{step.prompt}</em></span><span className="flow-node-edit">Edit</span></button>
                {branches.length > 0 && <><div className="flow-canvas-branch-stem" aria-hidden="true"/><div className="flow-canvas-branches">{branches.map((branch) => {
                  const active = selectedNode.kind === branch.kind && selectedNode.stepId === step.id && selectedNode.itemId === branch.id;
                  const phraseList = branch.kind === "choice" ? [branch.label] : branch.keywords;
                  const event = branch.action === "openSupport" ? "Open support request" : branch.action === "openOrderTracking" ? "Open order lookup" : branch.action === "continueAI" ? "Search store knowledge" : branch.nextFlowId ? `Continue to ${flows.find((flow) => flow.id === branch.nextFlowId)?.name || "another flow"}` : branch.nextStepId ? `Continue to ${selectedFlow.steps.find((item) => item.id === branch.nextStepId)?.title || "next step"}` : "Continue conversation";
                  return <button key={`${branch.kind}-${branch.id}`} type="button" className={`flow-canvas-branch-node ${active ? "active" : ""}`} onClick={() => setSelectedNode({ kind: branch.kind, stepId: step.id, itemId: branch.id })}><span className="flow-branch-type">{branch.kind === "choice" ? "CHOICE" : "WHEN CUSTOMER SAYS"}</span><strong>{phraseList.slice(0, 3).join(", ") || "Add matching phrase"}{phraseList.length > 3 ? ` +${phraseList.length - 3}` : ""}</strong><small>{branch.reply || (branch.kind === "choice" ? "Show next guided step" : "Use the selected action")}</small><span className="flow-branch-event">→ {event}</span></button>;
                })}</div></>}
                {stepIndex < selectedFlow.steps.length - 1 && <div className="flow-canvas-nextline" aria-hidden="true"/>}
              </section>;
            })}</div>
          </div>

          {selectedNode && <aside className="flow-inspector" aria-label="Selected flow node settings">
            <header className="flow-inspector-header"><div><span className="rag-eyebrow">EDIT SELECTED NODE</span><h3>{selectedNode.kind === "start" ? "Flow entry" : selectedNode.kind === "step" ? selectedStep?.title : selectedNode.kind === "choice" ? "Customer choice" : "Customer message rule"}</h3><p>{selectedNode.kind === "start" ? "Set the flow name and matching customer phrases." : selectedNode.kind === "step" ? "Edit what the assistant says at this step." : "Set the matching customer phrase, reply, and next action."}</p></div><button type="button" className="flow-inspector-close" aria-label="Close editor" onClick={() => setSelectedNode(null)}>×</button></header>
            <fetcher.Form method="post" className="flow-inspector-form"><input type="hidden" name="intent" value="saveFlows"/><input type="hidden" name="flows" value={JSON.stringify(flows)}/>
              {selectedNode.kind === "start" && <><label className="admin-field">Flow name<input className="admin-text-input" maxLength={80} value={selectedFlow.name} onChange={(event) => updateFlow((flow) => ({ ...flow, name: event.target.value }))}/></label><label className="admin-field">Purpose<input className="admin-text-input" maxLength={220} value={selectedFlow.description} onChange={(event) => updateFlow((flow) => ({ ...flow, description: event.target.value }))}/></label><label className="admin-field">Customer messages that start this flow<textarea className="admin-text-input admin-textarea" rows={4} value={triggerText} onChange={(event) => updateFlow((flow) => ({ ...flow, triggerTerms: event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 30) }))}/><small>Separate phrases with commas. Matching ignores case and punctuation.</small></label><div className="flow-inspector-tip">This flow’s prompts, phrases, replies, and actions are saved to the vector library when you save.</div></>}
              {selectedNode.kind === "step" && selectedStep && <><label className="admin-field">Step name<input className="admin-text-input" maxLength={80} value={selectedStep.title} onChange={(event) => updateStep(selectedStep.id, (step) => ({ ...step, title: event.target.value }))}/></label><label className="admin-field">Assistant message<textarea className="admin-text-input admin-textarea" rows={5} maxLength={1000} value={selectedStep.prompt} onChange={(event) => updateStep(selectedStep.id, (step) => ({ ...step, prompt: event.target.value }))}/></label><div className="flow-inspector-summary"><strong>Branches from this step</strong><span>{(selectedStep.choices || []).length} choices · {(selectedStep.routes || []).length} typed message rules</span><small>Click a branch card in the canvas to edit its exact phrase, reply, or action.</small></div>{selectedStep.inputReply && <label className="admin-field">Reply after the customer responds<textarea className="admin-text-input admin-textarea" rows={3} value={selectedStep.inputReply} onChange={(event) => updateStep(selectedStep.id, (step) => ({ ...step, inputReply: event.target.value }))}/></label>}</>}
              {selectedNode.kind === "choice" && selectedChoice && <><label className="admin-field">Button text shown to customer<input className="admin-text-input" maxLength={100} value={selectedChoice.label} onChange={(event) => setChoice(selectedStep.id, selectedChoice.id, (choice) => ({ ...choice, label: event.target.value }))}/></label><label className="admin-field">Assistant reply<textarea className="admin-text-input admin-textarea" rows={4} maxLength={500} value={selectedChoice.reply || ""} onChange={(event) => setChoice(selectedStep.id, selectedChoice.id, (choice) => ({ ...choice, reply: event.target.value }))}/></label><BranchActionEditor branch={selectedChoice} flow={selectedFlow} flows={flows} action={branchAction(selectedChoice)} onActionChange={(action) => setChoice(selectedStep.id, selectedChoice.id, (choice) => ({ ...choice, ...branchActionUpdate(action) }))} onFlowChange={(flowId) => updateBranchTargetFlow("choice", selectedStep.id, selectedChoice.id, flowId)} onStepChange={(stepId) => updateBranchTargetStep("choice", selectedStep.id, selectedChoice.id, stepId)}/></>}
              {selectedNode.kind === "route" && selectedRoute && <><label className="admin-field">Customer phrases<textarea className="admin-text-input admin-textarea" rows={3} value={(selectedRoute.keywords || []).join(", ")} onChange={(event) => setRoute(selectedStep.id, selectedRoute.id, (route) => ({ ...route, keywords: event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 30) }))}/><small>Use comma-separated ways a customer might say the same thing.</small></label><label className="admin-field">Assistant reply<textarea className="admin-text-input admin-textarea" rows={5} maxLength={500} value={selectedRoute.reply || ""} onChange={(event) => setRoute(selectedStep.id, selectedRoute.id, (route) => ({ ...route, reply: event.target.value }))}/></label><BranchActionEditor branch={selectedRoute} flow={selectedFlow} flows={flows} action={branchAction(selectedRoute)} onActionChange={(action) => setRoute(selectedStep.id, selectedRoute.id, (route) => ({ ...route, ...branchActionUpdate(action) }))} onFlowChange={(flowId) => updateBranchTargetFlow("route", selectedStep.id, selectedRoute.id, flowId)} onStepChange={(stepId) => updateBranchTargetStep("route", selectedStep.id, selectedRoute.id, stepId)}/></>}
              <footer className="flow-inspector-footer"><span><AdminIcon name="info"/> Changes apply to new shopper messages.</span>{saveButton}</footer>
            </fetcher.Form>
          </aside>}
        </div>
      </section>
    </section>
  </s-page>;
}

function BranchActionEditor({ branch, flow, flows, action, onActionChange, onFlowChange, onStepChange }) {
  const targetFlow = flows.find((item) => item.id === branch.nextFlowId) || flow;
  const steps = targetFlow.steps;
  return <>
    <label className="admin-field">Next action<select className="admin-text-input" value={action} onChange={(event) => onActionChange(event.target.value)}><option value="continueAI">Search store knowledge and catalog</option><option value="openOrderTracking">Open secure order lookup</option><option value="openSupport">Open support request</option><option value="nextStep">Continue to a step in this flow</option><option value="nextFlow">Continue to another flow</option></select></label>
    {action === "nextFlow" && <label className="admin-field">Next flow<select className="admin-text-input" value={targetFlow.id} onChange={(event) => onFlowChange(event.target.value)}>{flows.filter((item) => item.id !== flow.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {(action === "nextStep" || action === "nextFlow") && <label className="admin-field">Next step<select className="admin-text-input" value={branch.nextStepId || steps[0]?.id || ""} onChange={(event) => onStepChange(event.target.value)}>{steps.map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}</select></label>}
  </>;
}

export const headers = (args) => boundary.headers(args);
