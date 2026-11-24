export function AdminIcon({ name, size = 16 }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6" /><path d="M10 11v5m4-5v5" /></>,
    archive: <><path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    "arrow-left": <><path d="m15 18-6-6 6-6"/><path d="M20 12H9"/></>,
    "arrow-right": <><path d="m9 18 6-6-6-6"/><path d="M4 12h11"/></>,
    chat: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z" /></>,
    ticket: <><path d="M3 8V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6Z" /><path d="M13 5v2m0 4v2m0 4v2" /></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.6a8 8 0 0 1-1.6.9l-.4 1.9h-2.8l-.4-1.9a8 8 0 0 1-1.6-.9l-1.8.6-1.4-2.4L7 15a8 8 0 0 1 0-1.9l-1.3-1.2 1.4-2.4 1.8.6a8 8 0 0 1 1.6-.9l.4-1.9h2.8l.4 1.9a8 8 0 0 1 1.6.9l1.8-.6 1.4 2.4-1.3 1.2a8 8 0 0 1-.2 1.9Z" /></>,
  };
  return <svg className="admin-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] || paths.check}</svg>;
}

export default function AdminPageHeader({ title, description, metrics = [] }) {
  return <header className="admin-page-header"><div className="admin-page-intro"><span className="admin-page-kicker">SHOPAI CONCIERGE</span><h1>{title}</h1><p>{description}</p></div><div className="admin-page-tools">{metrics.length > 0 && <div className="admin-page-metrics">{metrics.map((metric) => <div className="admin-page-metric" key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div>}</div></header>;
}
