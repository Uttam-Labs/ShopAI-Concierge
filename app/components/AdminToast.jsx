import { useEffect, useRef, useState } from "react";

export function useActionToast(fetcher) {
  const lastData = useRef(null);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || fetcher.data === lastData.current) return;
    lastData.current = fetcher.data;
    const data = fetcher.data;
    let notice;
    if (data.error) notice = { type: "error", title: "Action needs attention", message: String(data.error) };
    else if (data.indexingWarning) notice = { type: "warning", title: "Sources saved · indexing needs setup", message: String(data.indexingWarning) };
    else if (data.connected) notice = { type: "success", title: "AI provider connected", message: `${data.aiProvider === "gemini" ? "Google Gemini" : data.aiProvider === "anthropic" ? "Anthropic Claude" : "OpenAI"} was verified and saved successfully.` };
    else if (data.deleted) notice = { type: "success", title: "Item deleted", message: "The change has been saved." };
    else if (data.updated) notice = { type: "success", title: "Status updated", message: "Your latest changes are now saved." };
    else if (data.saved && data.indexed) notice = { type: "success", title: "Knowledge indexed", message: `${data.indexedCount} sources are ready for concierge answers.` };
    else if (data.saved && data.indexed === false) notice = { type: "warning", title: "Sources saved", message: "They are saved, but indexing still needs setup." };
    else if (data.saved) notice = { type: "success", title: "Changes saved", message: "Your updates are ready to use." };
    if (notice) window.dispatchEvent(new CustomEvent("shopai:toast", { detail: notice }));
  }, [fetcher.state, fetcher.data]);
}

export default function AdminToastHost() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    const show = (event) => {
      setToast({ ...event.detail, id: Date.now() });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 4600);
    };
    window.addEventListener("shopai:toast", show);
    return () => { window.removeEventListener("shopai:toast", show); window.clearTimeout(timer.current); };
  }, []);
  if (!toast) return null;
  return <aside className={`admin-toast ${toast.type}`} role={toast.type === "error" ? "alert" : "status"} key={toast.id}><span className="admin-toast-mark">{toast.type === "success" ? "✓" : toast.type === "warning" ? "!" : "×"}</span><span className="admin-toast-copy"><strong>{toast.title}</strong><small>{toast.message}</small></span><button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></aside>;
}
