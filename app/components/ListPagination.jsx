import { AdminIcon } from "./AdminPageHeader";

export default function ListPagination({ label, page, pageCount, total, onPageChange }) {
  const pageSize = 25;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return <nav className="admin-list-pagination" aria-label={`${label} pages`}><span className="admin-pagination-summary">Showing <strong>{start}–{end}</strong> of <strong>{total}</strong> {label.toLowerCase()}</span><div className="admin-pagination-controls"><button className="admin-secondary" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><AdminIcon name="arrow-left"/> Previous</button><span>Page <strong>{page}</strong> of <strong>{pageCount}</strong></span><button className="admin-secondary" type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next <AdminIcon name="arrow-right"/></button></div></nav>;
}
