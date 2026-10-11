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
import type { Handle } from "remix/component";

import { routes } from "../routes.ts";
import { LabelList, PriorityBadge, StatusBadge } from "./badges.tsx";

/** The controls of the project page's GET filter form; the page renders the `<form>` itself. */
export function FilterFields(handle: Handle<{ filters: IssueFilters; labels: Label[] }>) {
  return () => {
    const { filters, labels } = handle.props;
    return (
      <>
        <label class="filter">
          <span>Status</span>
          <select name="status">
            <option value="">Any</option>
            {STATUSES.map((status) => (
              <option key={status} value={status} selected={status === filters.status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label class="filter">
          <span>Priority</span>
          <select name="priority">
            <option value="">Any</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority} selected={priority === filters.priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </label>
        <label class="filter">
          <span>Label</span>
          <select name="label">
            <option value="">Any</option>
            {labels.map((label) => (
              <option key={label.id} value={label.name} selected={label.name === filters.label}>
                {label.name}
              </option>
            ))}
          </select>
        </label>
        <label class="filter">
          <span>Sort</span>
          <select name="sort">
            {SORTS.map((sort) => (
              <option key={sort} value={sort} selected={sort === filters.sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </select>
        </label>
        <label class="filter filter-q">
          <span>Title</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Filter by title"
          />
        </label>
        <button type="submit" class="btn" data-testid="filter-submit">
          Apply
        </button>
      </>
    );
  };
}

/** The project page's issue table; its row checkboxes belong to the bulk-select form. */
export function IssueTable(handle: Handle<{ issues: IssueSummary[] }>) {
  return () => (
    <table class="table issue-table" data-testid="issue-table">
      <thead>
        <tr>
          <th class="col-check">
            <input type="checkbox" aria-label="Select all" data-testid="select-all" />
          </th>
          <th class="num">#</th>
          <th>Title</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Assignee</th>
          <th class="num">Comments</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {handle.props.issues.map((issue) => (
          <tr key={issue.id} data-testid="issue-row" data-issue-id={String(issue.id)}>
            <td class="col-check">
              <input
                type="checkbox"
                name="ids"
                value={String(issue.id)}
                aria-label={`Select issue #${issue.id}`}
                data-testid="row-select"
              />
            </td>
            <td class="num muted">{issue.id}</td>
            <td class="col-title">
              <a href={routes.issues.show.href({ id: String(issue.id) })} class="issue-link">
                {issue.title}
              </a>
              <LabelList labels={issue.labels} />
            </td>
            <td>
              <StatusBadge status={issue.status} />
            </td>
            <td>
              <PriorityBadge priority={issue.priority} />
            </td>
            <td>
              {issue.assignee ? issue.assignee.displayName : <span class="muted">Unassigned</span>}
            </td>
            <td class="num">{issue.commentCount}</td>
            <td>
              <time dateTime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Pagination(
  handle: Handle<{ page: number; totalPages: number; hrefFor: (page: number) => string }>,
) {
  return () => {
    const { page, totalPages, hrefFor } = handle.props;
    if (totalPages <= 1) return null;
    return (
      <nav class="pagination" data-testid="pagination" aria-label="Pagination">
        {page > 1 ? (
          <a href={hrefFor(page - 1)} rel="prev" class="btn" data-testid="page-prev">
            Previous
          </a>
        ) : (
          <span class="btn disabled">Previous</span>
        )}
        <span class="page-info" data-testid="page-info">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <a href={hrefFor(page + 1)} rel="next" class="btn" data-testid="page-next">
            Next
          </a>
        ) : (
          <span class="btn disabled">Next</span>
        )}
      </nav>
    );
  };
}
