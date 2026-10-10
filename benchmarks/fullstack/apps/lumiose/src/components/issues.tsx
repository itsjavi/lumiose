// The project page's filters, issue table and pagination: the markup of @bench/react-ui's
// issues.tsx. They are server components; the bulk-select island wraps the table and handles the
// checkboxes in the browser.
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

function Options(props: {
  values: readonly string[];
  labels: Record<string, string>;
  selected: string | undefined;
}) {
  return props.values.map((value) => (
    <option value={value} selected={value === props.selected}>
      {props.labels[value]}
    </option>
  ));
}

/** The controls of the project page's GET filter form. */
export function FilterFields(props: { filters: IssueFilters; labels: Label[] }) {
  return (
    <>
      <label class="filter">
        <span>Status</span>
        <select name="status">
          <option value="" selected={props.filters.status === undefined}>
            Any
          </option>
          <Options values={STATUSES} labels={STATUS_LABELS} selected={props.filters.status} />
        </select>
      </label>
      <label class="filter">
        <span>Priority</span>
        <select name="priority">
          <option value="" selected={props.filters.priority === undefined}>
            Any
          </option>
          <Options values={PRIORITIES} labels={PRIORITY_LABELS} selected={props.filters.priority} />
        </select>
      </label>
      <label class="filter">
        <span>Label</span>
        <select name="label">
          <option value="" selected={props.filters.label === undefined}>
            Any
          </option>
          <Options
            values={props.labels.map((label) => label.name)}
            labels={Object.fromEntries(props.labels.map((label) => [label.name, label.name]))}
            selected={props.filters.label}
          />
        </select>
      </label>
      <label class="filter">
        <span>Sort</span>
        <select name="sort">
          <Options values={SORTS} labels={SORT_LABELS} selected={props.filters.sort} />
        </select>
      </label>
      <label class="filter filter-q">
        <span>Title</span>
        <input type="search" name="q" value={props.filters.q ?? ""} placeholder="Filter by title" />
      </label>
      <button type="submit" class="btn" data-testid="filter-submit">
        Apply
      </button>
    </>
  );
}

export function IssueTable(props: { issues: IssueSummary[] }) {
  return (
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
        {props.issues.map((issue) => (
          <tr data-testid="issue-row" data-issue-id={String(issue.id)}>
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
              <a href={`/issues/${issue.id}`} class="issue-link">
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
            <td>{issue.assignee?.displayName ?? <span class="muted">Unassigned</span>}</td>
            <td class="num">{issue.commentCount}</td>
            <td>
              <time datetime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Pagination(props: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  return props.totalPages <= 1 ? null : (
    <nav class="pagination" data-testid="pagination" aria-label="Pagination">
      {props.page > 1 ? (
        <a href={props.hrefFor(props.page - 1)} rel="prev" class="btn" data-testid="page-prev">
          Previous
        </a>
      ) : (
        <span class="btn disabled">Previous</span>
      )}
      <span class="page-info" data-testid="page-info">
        Page {props.page} of {props.totalPages}
      </span>
      {props.page < props.totalPages ? (
        <a href={props.hrefFor(props.page + 1)} rel="next" class="btn" data-testid="page-next">
          Next
        </a>
      ) : (
        <span class="btn disabled">Next</span>
      )}
    </nav>
  );
}
