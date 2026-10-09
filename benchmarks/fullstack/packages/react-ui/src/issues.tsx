import {
  PRIORITIES,
  PRIORITY_LABELS,
  SORTS,
  SORT_LABELS,
  STATUSES,
  STATUS_LABELS,
  formatDate,
  type IssueFilters,
  type IssueSummary,
  type Label,
} from "@bench/data/format";
import { LabelList, PriorityBadge, StatusBadge } from "./badges.tsx";
import type { LinkComponent } from "./link.tsx";

/** The controls of the project page's GET filter form; the app renders the `<form>` itself. */
export function FilterFields({ filters, labels }: { filters: IssueFilters; labels: Label[] }) {
  return (
    <>
      <label className="filter">
        <span>Status</span>
        <select name="status" defaultValue={filters.status ?? ""}>
          <option value="">Any</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="filter">
        <span>Priority</span>
        <select name="priority" defaultValue={filters.priority ?? ""}>
          <option value="">Any</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </label>
      <label className="filter">
        <span>Label</span>
        <select name="label" defaultValue={filters.label ?? ""}>
          <option value="">Any</option>
          {labels.map((label) => (
            <option key={label.id} value={label.name}>
              {label.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter">
        <span>Sort</span>
        <select name="sort" defaultValue={filters.sort}>
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </select>
      </label>
      <label className="filter filter-q">
        <span>Title</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Filter by title"
        />
      </label>
      <button type="submit" className="btn" data-testid="filter-submit">
        Apply
      </button>
    </>
  );
}

export interface IssueTableProps {
  Link: LinkComponent;
  issues: IssueSummary[];
  selected: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
}

/** The project page's issue table with row checkboxes (rendered by the app's bulk-select client component). */
export function IssueTable({ Link, issues, selected, onToggle, onToggleAll }: IssueTableProps) {
  const allSelected = issues.length > 0 && issues.every((issue) => selected.has(issue.id));
  return (
    <table className="table issue-table" data-testid="issue-table">
      <thead>
        <tr>
          <th className="col-check">
            <input
              type="checkbox"
              aria-label="Select all"
              data-testid="select-all"
              checked={allSelected}
              onChange={onToggleAll}
            />
          </th>
          <th className="num">#</th>
          <th>Title</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Assignee</th>
          <th className="num">Comments</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((issue) => (
          <tr key={issue.id} data-testid="issue-row" data-issue-id={issue.id}>
            <td className="col-check">
              <input
                type="checkbox"
                name="ids"
                value={issue.id}
                aria-label={`Select issue #${issue.id}`}
                data-testid="row-select"
                checked={selected.has(issue.id)}
                onChange={() => onToggle(issue.id)}
              />
            </td>
            <td className="num muted">{issue.id}</td>
            <td className="col-title">
              <Link href={`/issues/${issue.id}`} className="issue-link">
                {issue.title}
              </Link>
              <LabelList labels={issue.labels} />
            </td>
            <td>
              <StatusBadge status={issue.status} />
            </td>
            <td>
              <PriorityBadge priority={issue.priority} />
            </td>
            <td>{issue.assignee?.displayName ?? <span className="muted">Unassigned</span>}</td>
            <td className="num">{issue.commentCount}</td>
            <td>
              <time dateTime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BulkBar({ count, pending }: { count: number; pending: boolean }) {
  return (
    <div className="bulk-bar">
      <span data-testid="selected-count">{count} selected</span>
      <button
        type="submit"
        className="btn btn-danger"
        data-testid="close-selected"
        disabled={count === 0 || pending}
      >
        {pending ? "Closing…" : "Close selected"}
      </button>
    </div>
  );
}

export interface PaginationProps {
  Link: LinkComponent;
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}

export function Pagination({ Link, page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" data-testid="pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className="btn" data-testid="page-prev">
          Previous
        </Link>
      ) : (
        <span className="btn disabled">Previous</span>
      )}
      <span className="page-info" data-testid="page-info">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className="btn" data-testid="page-next">
          Next
        </Link>
      ) : (
        <span className="btn disabled">Next</span>
      )}
    </nav>
  );
}
