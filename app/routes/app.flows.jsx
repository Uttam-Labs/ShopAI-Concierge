/* eslint-disable react/prop-types */
/* eslint-env node */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connections, setConnections] = useState({});
  const canvasRef = useRef(null);
  useEffect(() => { if (fetcher.data?.saved) setFlows(fetcher.data.flows); }, [fetcher.data]);
  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) || null;
  const updateFlow = (updater) => { if (selectedFlow) setFlows((current) => current.map((flow) => flow.id === selectedFlow.id ? updater(flow) : flow)); };
  const updateStep = (stepId, updater) => updateFlow((flow) => ({ ...flow, steps: flow.steps.map((step) => step.id === stepId ? updater(step) : step) }));
  const selectedStep = selectedNode?.stepId ? selectedFlow?.steps.find((step) => step.id === selectedNode.stepId) : null;
  const selectedChoice = selectedNode?.kind === "choice" ? selectedStep?.choices?.find((choice) => choice.id === selectedNode.itemId) : null;
  const selectedRoute = selectedNode?.kind === "route" ? selectedStep?.routes?.find((route) => route.id === selectedNode.itemId) : null;
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
  const triggerText = selectedFlow?.triggerTerms.join(", ") || "";
  const saveButton = <button className="admin-cta" type="submit" disabled={isSaving}><AdminIcon name="save"/>{isSaving ? "Saving and indexing…" : "Save changes"}</button>;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const measure = () => {
      const next = {};
      canvas.querySelectorAll(".flow-canvas-step-group").forEach((group) => {
        const groupRect = group.getBoundingClientRect();
        const source = group.querySelector(".flow-canvas-step");
        if (!source) return;
        const sourceRect = source.getBoundingClientRect();
        const startX = sourceRect.left + sourceRect.width / 2 - groupRect.left;
        const startY = sourceRect.bottom - groupRect.top;
        const branches = [...group.querySelectorAll(".flow-canvas-branch-node")];
        const junctionY = startY + Math.min(28, Math.max(16, (branches[0]?.getBoundingClientRect().top - groupRect.top - startY) * 0.35));
        const paths = branches.map((branch) => {
          const target = branch.getBoundingClientRect();
          const endX = target.left + target.width / 2 - groupRect.left;
          const endY = target.top - groupRect.top + 1;
          const bend = Math.max(20, Math.min(44, (endY - junctionY) * 0.55));
          return `M ${startX} ${startY} L ${startX} ${junctionY} C ${startX} ${junctionY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`;
        });
        next[group.dataset.stepId] = { width: group.clientWidth, height: group.clientHeight, paths };
      });
      setConnections((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    canvas.querySelectorAll(".flow-canvas-step-group, .flow-canvas-step, .flow-canvas-branch-node").forEach((node) => observer.observe(node));
    window.addEventListener("resize", measure);
    const frame = requestAnimationFrame(measure);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [selectedFlowId, selectedFlow, selectedNode]);

  useEffect(() => {
    if (!selectedNode) return undefined;
    const handleKeyDown = (event) => { if (event.key === "Escape") setSelectedNode(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode]);

  return <s-page heading="Flows" inlineSize="large">
    <AdminPageHeader title="Conversation flows" description="Map customer messages to helpful replies and actions. Click any node to edit it in the side panel." metrics={[{ label: "Built-in flows", value: flows.length }, { label: "Enabled", value: flows.filter((flow) => flow.enabled).length }, { label: "Vector context", value: "Synced on save" }]}/>
    <section className="flow-studio">
      <aside className="flow-studio-library" aria-label="Flow library">
        <div className="flow-studio-library-heading"><span className="rag-eyebrow">FLOW LIBRARY</span><h2>Choose a flow</h2><p>Built-in flows can be customized and switched on or off.</p></div>
        <div className="flow-studio-flow-list">{flows.map((flow) => <button key={flow.id} type="button" className={`flow-studio-flow-button ${flow.id === selectedFlowId ? "selected" : ""}`} onClick={() => { setSelectedFlowId(flow.id); setSelectedNode(null); }}><span className="flow-studio-flow-icon"><AdminIcon name={flow.id === "product-discovery" ? "search" : flow.id === "returns-support" ? "ticket" : flow.id === "order-updates" ? "list" : "chat"}/></span><span><strong>{flow.name}</strong><small>{flow.steps.length} steps · {flow.enabled ? "On" : "Off"}</small></span><span className={`flow-enabled-pill ${flow.enabled ? "active" : ""}`}>{flow.enabled ? "On" : "Off"}</span></button>)}</div>
      </aside>

      <section className="flow-studio-main">
        <header className="flow-studio-toolbar"><div><span className="rag-eyebrow">VISUAL FLOW BUILDER</span><h2>{selectedFlow?.name || "Choose a flow"}</h2><p>{selectedFlow ? "Select a step or branch to edit its reply and next action." : "Choose a flow from the library to view its conversation map."}</p></div>{selectedFlow && <label className="flow-toggle" aria-label="Enable this flow"><input type="checkbox" checked={selectedFlow.enabled} onChange={(event) => updateFlow((flow) => ({ ...flow, enabled: event.target.checked }))}/><span className="flow-toggle-track"/><span><strong>{selectedFlow.enabled ? "Enabled" : "Disabled"}</strong><small>{selectedFlow.enabled ? "Available in storefront chat" : "Hidden from shoppers"}</small></span></label>}</header>
        <div className="flow-studio-body">
          {!selectedFlow && <div className="flow-canvas-empty"><span className="flow-studio-flow-icon"><AdminIcon name="list"/></span><strong>Your flow map will appear here</strong><p>Select one of the built-in flows on the left to see how customer messages connect to replies and actions.</p></div>}
          {selectedFlow && <>
          <div className="flow-canvas-wrap" ref={canvasRef}>
            <div className="flow-canvas-help"><span>START</span><p>Customer messages matching one of these phrases enter this flow.</p></div>
            <button type="button" className={`flow-canvas-node flow-canvas-start ${selectedNode?.kind === "start" ? "active" : ""}`} onClick={() => setSelectedNode({ kind: "start" })}><span className="flow-node-icon"><AdminIcon name="bolt"/></span><span><small>FLOW ENTRY</small><strong>{selectedFlow.name}</strong><em>{selectedFlow.triggerTerms.slice(0, 5).join(", ")}{selectedFlow.triggerTerms.length > 5 ? ` +${selectedFlow.triggerTerms.length - 5} more` : ""}</em></span><span className="flow-node-edit">Edit</span></button>
            <div className="flow-canvas-flowline" aria-hidden="true"/>
            <div className="flow-canvas-steps">{selectedFlow.steps.map((step, stepIndex) => {
              const branches = [...(step.choices || []).map((item) => ({ ...item, kind: "choice" })), ...(step.routes || []).map((item) => ({ ...item, kind: "route" }))];
              const isStepActive = selectedNode?.kind === "step" && selectedNode.stepId === step.id;
              return <section className="flow-canvas-step-group" data-step-id={step.id} key={step.id}>
                {connections[step.id]?.paths?.length > 0 && <svg className="flow-canvas-connectors" viewBox={`0 0 ${connections[step.id].width} ${connections[step.id].height}`} preserveAspectRatio="none" aria-hidden="true"><defs><marker id={`flow-arrow-${step.id}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 8 4 L 0 8"/></marker></defs>{connections[step.id].paths.map((path, index) => <path key={`${step.id}-connector-${index}`} d={path} markerEnd={`url(#flow-arrow-${step.id})`}/>)}</svg>}
                <button type="button" className={`flow-canvas-node flow-canvas-step ${isStepActive ? "active" : ""}`} onClick={() => setSelectedNode({ kind: "step", stepId: step.id })}><span className="flow-node-index">{String(stepIndex + 1).padStart(2, "0")}</span><span><small>{step.inputAction ? "ASSISTANT STEP" : "CONVERSATION STEP"}</small><strong>{step.title}</strong><em>{step.prompt}</em></span><span className="flow-node-edit">Edit</span></button>
                {branches.length > 0 && <><div className="flow-canvas-branch-stem" aria-hidden="true"/><div className="flow-canvas-branches">{branches.map((branch) => {
                  const active = selectedNode?.kind === branch.kind && selectedNode.stepId === step.id && selectedNode.itemId === branch.id;
                  const phraseList = branch.kind === "choice" ? [branch.label] : branch.keywords;
                  const targetFlow = branch.nextFlowId ? flows.find((flow) => flow.id === branch.nextFlowId) : selectedFlow;
                  const targetStep = branch.nextStepId ? targetFlow?.steps.find((item) => item.id === branch.nextStepId) : null;
                  const event = branch.action === "openSupport" ? "Open the support request form" : branch.action === "openOrderTracking" ? "Open secure order lookup" : branch.action === "continueAI" ? "Search store info and catalog" : targetStep ? `Show next question: ${targetStep.title}` : "Continue the conversation";
                  const assistantText = branch.reply || targetStep?.prompt || "The assistant continues with the next available step.";
                  return <button key={`${branch.kind}-${branch.id}`} type="button" className={`flow-canvas-branch-node ${active ? "active" : ""}`} onClick={() => setSelectedNode({ kind: branch.kind, stepId: step.id, itemId: branch.id })}><span className="flow-branch-type">{branch.kind === "choice" ? "SHOPPER SELECTS" : "SHOPPER SAYS"}</span><strong>{phraseList.slice(0, 3).join(", ") || "Add matching phrase"}{phraseList.length > 3 ? ` +${phraseList.length - 3}` : ""}</strong><small><b>Assistant says</b> {assistantText}</small><span className="flow-branch-event">Next: {event}</span></button>;
                })}</div></>}
                {stepIndex < selectedFlow.steps.length - 1 && <div className="flow-canvas-nextline" aria-hidden="true"/>}
              </section>;
            })}</div>
          </div>
          </>}
        </div>
        {selectedNode && selectedFlow && <>
          <button type="button" className="flow-inspector-backdrop" aria-label="Close flow editor" onClick={() => setSelectedNode(null)}/>
          <aside className="flow-inspector" role="dialog" aria-modal="true" aria-label="Selected flow node settings">
            <header className="flow-inspector-header"><div><span className="rag-eyebrow">EDIT SELECTED NODE</span><h3>{selectedNode.kind === "start" ? "Flow entry" : selectedNode.kind === "step" ? selectedStep?.title : selectedNode.kind === "choice" ? "Shopper button" : "Typed reply rule"}</h3><p>{selectedNode.kind === "start" ? "Set the flow name and the messages that start it." : selectedNode.kind === "step" ? "Edit the message the shopper sees at this step." : selectedNode.kind === "choice" ? "Edit the button, optional reply, and what happens after the click." : "Edit matching shopper phrases, the reply, and what happens next."}</p></div><button type="button" className="flow-inspector-close" aria-label="Close editor" onClick={() => setSelectedNode(null)}>×</button></header>
            <fetcher.Form method="post" className="flow-inspector-form"><input type="hidden" name="intent" value="saveFlows"/><input type="hidden" name="flows" value={JSON.stringify(flows)}/>
              {selectedNode.kind === "start" && <><label className="admin-field">Flow name<input className="admin-text-input" maxLength={80} value={selectedFlow.name} onChange={(event) => updateFlow((flow) => ({ ...flow, name: event.target.value }))}/></label><label className="admin-field">Purpose<input className="admin-text-input" maxLength={220} value={selectedFlow.description} onChange={(event) => updateFlow((flow) => ({ ...flow, description: event.target.value }))}/></label><label className="admin-field">Customer messages that start this flow<textarea className="admin-text-input admin-textarea" rows={4} value={triggerText} onChange={(event) => updateFlow((flow) => ({ ...flow, triggerTerms: event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 30) }))}/><small>Separate phrases with commas. Matching ignores case and punctuation.</small></label><div className="flow-inspector-tip">This flow’s prompts, phrases, replies, and actions are saved to the vector library when you save.</div></>}
              {selectedNode.kind === "step" && selectedStep && <><label className="admin-field">Internal step name<input className="admin-text-input" maxLength={80} value={selectedStep.title} onChange={(event) => updateStep(selectedStep.id, (step) => ({ ...step, title: event.target.value }))}/><small>For your flow map; shoppers see the assistant message below.</small></label><label className="admin-field">Message shown to the shopper<textarea className="admin-text-input admin-textarea" rows={5} maxLength={1000} value={selectedStep.prompt} onChange={(event) => updateStep(selectedStep.id, (step) => ({ ...step, prompt: event.target.value }))}/></label><div className="flow-inspector-summary"><strong>What can happen next?</strong><span>{(selectedStep.choices || []).length} buttons shoppers can choose · {(selectedStep.routes || []).length} typed reply rules</span><small>Select any branch card to edit its matching words, assistant message, or next action.</small></div>{selectedStep.inputReply && <label className="admin-field">Reply after shopper types a response<textarea className="admin-text-input admin-textarea" rows={3} value={selectedStep.inputReply} onChange={(event) => updateStep(selectedStep.id, (step) => ({ ...step, inputReply: event.target.value }))}/></label>}</>}
              {selectedNode.kind === "choice" && selectedChoice && <><label className="admin-field">Button text shown to the shopper<input className="admin-text-input" maxLength={100} value={selectedChoice.label} onChange={(event) => setChoice(selectedStep.id, selectedChoice.id, (choice) => ({ ...choice, label: event.target.value }))}/></label><label className="admin-field">Optional reply before the next step<textarea className="admin-text-input admin-textarea" placeholder="Leave blank to show the next step’s message directly." rows={3} maxLength={500} value={selectedChoice.reply || ""} onChange={(event) => setChoice(selectedStep.id, selectedChoice.id, (choice) => ({ ...choice, reply: event.target.value }))}/><small>{selectedChoice.reply ? "This reply appears before the next step." : "No extra reply is set. The next step’s message appears after the shopper clicks."}</small></label><BranchActionEditor branch={selectedChoice} flow={selectedFlow} flows={flows} action={branchAction(selectedChoice)} onActionChange={(action) => setChoice(selectedStep.id, selectedChoice.id, (choice) => ({ ...choice, ...branchActionUpdate(action) }))} onFlowChange={(flowId) => updateBranchTargetFlow("choice", selectedStep.id, selectedChoice.id, flowId)} onStepChange={(stepId) => updateBranchTargetStep("choice", selectedStep.id, selectedChoice.id, stepId)}/><BranchPreview branch={selectedChoice} flow={selectedFlow} flows={flows}/></>}
              {selectedNode.kind === "route" && selectedRoute && <><label className="admin-field">Customer phrases that match<textarea className="admin-text-input admin-textarea" rows={3} value={(selectedRoute.keywords || []).join(", ")} onChange={(event) => setRoute(selectedStep.id, selectedRoute.id, (route) => ({ ...route, keywords: event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 30) }))}/><small>Enter common ways a shopper might say this, separated by commas.</small></label><label className="admin-field">Assistant reply<textarea className="admin-text-input admin-textarea" placeholder="Optional. Leave blank to continue with the next step or store search." rows={4} maxLength={500} value={selectedRoute.reply || ""} onChange={(event) => setRoute(selectedStep.id, selectedRoute.id, (route) => ({ ...route, reply: event.target.value }))}/></label><BranchActionEditor branch={selectedRoute} flow={selectedFlow} flows={flows} action={branchAction(selectedRoute)} onActionChange={(action) => setRoute(selectedStep.id, selectedRoute.id, (route) => ({ ...route, ...branchActionUpdate(action) }))} onFlowChange={(flowId) => updateBranchTargetFlow("route", selectedStep.id, selectedRoute.id, flowId)} onStepChange={(stepId) => updateBranchTargetStep("route", selectedStep.id, selectedRoute.id, stepId)}/><BranchPreview branch={selectedRoute} flow={selectedFlow} flows={flows}/></>}
              <footer className="flow-inspector-footer"><span><AdminIcon name="info"/> Changes apply to new shopper messages.</span>{saveButton}</footer>
            </fetcher.Form>
          </aside>
        </>}
      </section>
    </section>
  </s-page>;
}

function BranchActionEditor({ branch, flow, flows, action, onActionChange, onFlowChange, onStepChange }) {
  const targetFlow = flows.find((item) => item.id === branch.nextFlowId) || flow;
  const steps = targetFlow.steps;
  return <>
    <label className="admin-field">What should happen after the click or reply?<select className="admin-text-input" value={action} onChange={(event) => onActionChange(event.target.value)}><option value="continueAI">Search store information and products</option><option value="openOrderTracking">Open secure order lookup</option><option value="openSupport">Open support request form</option><option value="nextStep">Ask another question in this flow</option><option value="nextFlow">Switch to a different flow</option></select></label>
    {action === "nextFlow" && <label className="admin-field">Which flow should start next?<select className="admin-text-input" value={targetFlow.id} onChange={(event) => onFlowChange(event.target.value)}>{flows.filter((item) => item.id !== flow.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>The shopper will see that flow’s first question.</small></label>}
    {(action === "nextStep" || action === "nextFlow") && <label className="admin-field">Next question<select className="admin-text-input" value={branch.nextStepId || steps[0]?.id || ""} onChange={(event) => onStepChange(event.target.value)}>{steps.map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}</select></label>}
  </>;
}

function BranchPreview({ branch, flow, flows }) {
  const targetFlow = flows.find((item) => item.id === branch.nextFlowId) || flow;
  const targetStep = targetFlow.steps.find((step) => step.id === branch.nextStepId);
  if (!targetStep || branch.action === "continueAI" || branch.action === "openOrderTracking" || branch.action === "openSupport") return null;
  return <div className="flow-branch-preview"><strong>Next message shown to the shopper</strong><p>{targetStep.prompt}</p></div>;
}

export const headers = (args) => boundary.headers(args);
