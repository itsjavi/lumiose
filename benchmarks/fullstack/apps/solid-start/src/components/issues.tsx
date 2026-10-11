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
import { For, Show } from "solid-js";
import { LabelList, PriorityBadge, StatusBadge } from "./badges.tsx";

/** The controls of the project page's GET filter form; the page renders the `<form>` itself. */
export function FilterFields(props: { filters: IssueFilters; labels: Label[] }) {
  return (
    <>
      <label class="filter">
        <span>Status</span>
        <select name="status">
          <option value="">Any</option>
          <For each={STATUSES}>
            {(status) => (
              <option value={status} selected={props.filters.status === status}>
                {STATUS_LABELS[status]}
              </option>
            )}
          </For>
        </select>
      </label>
      <label class="filter">
        <span>Priority</span>
        <select name="priority">
          <option value="">Any</option>
          <For each={PRIORITIES}>
            {(priority) => (
              <option value={priority} selected={props.filters.priority === priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            )}
          </For>
        </select>
      </label>
      <label class="filter">
        <span>Label</span>
        <select name="label">
          <option value="">Any</option>
          <For each={props.labels}>
            {(label) => (
              <option value={label.name} selected={props.filters.label === label.name}>
                {label.name}
              </option>
            )}
          </For>
        </select>
      </label>
      <label class="filter">
        <span>Sort</span>
        <select name="sort">
          <For each={SORTS}>
            {(sort) => (
              <option value={sort} selected={props.filters.sort === sort}>
                {SORT_LABELS[sort]}
              </option>
            )}
          </For>
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

export interface IssueTableProps {
  issues: IssueSummary[];
  selected: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
}

/** The project page's issue table with row checkboxes (driven by the page's bulk select). */
export function IssueTable(props: IssueTableProps) {
  const allSelected = () =>
    props.issues.length > 0 && props.issues.every((issue) => props.selected.has(issue.id));
  return (
    <table class="table issue-table" data-testid="issue-table">
      <thead>
        <tr>
          <th class="col-check">
            <input
              type="checkbox"
              aria-label="Select all"
              data-testid="select-all"
              checked={allSelected()}
              onChange={() => props.onToggleAll()}
            />
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
        <For each={props.issues}>
          {(issue) => (
            <tr data-testid="issue-row" data-issue-id={issue.id}>
              <td class="col-check">
                <input
                  type="checkbox"
                  name="ids"
                  value={issue.id}
                  aria-label={`Select issue #${issue.id}`}
                  data-testid="row-select"
                  checked={props.selected.has(issue.id)}
                  onChange={() => props.onToggle(issue.id)}
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
              <td>
                <Show when={issue.assignee} fallback={<span class="muted">Unassigned</span>}>
                  {(assignee) => assignee().displayName}
                </Show>
              </td>
              <td class="num">{issue.commentCount}</td>
              <td>
                <time datetime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

export function BulkBar(props: { count: number; pending: boolean }) {
  return (
    <div class="bulk-bar">
      <span data-testid="selected-count">{props.count} selected</span>
      <button
        type="submit"
        class="btn btn-danger"
        data-testid="close-selected"
        disabled={props.count === 0 || props.pending}
      >
        {props.pending ? "Closing…" : "Close selected"}
      </button>
    </div>
  );
}

export function Pagination(props: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  return (
    <Show when={props.totalPages > 1}>
      <nav class="pagination" data-testid="pagination" aria-label="Pagination">
        <Show when={props.page > 1} fallback={<span class="btn disabled">Previous</span>}>
          <a href={props.hrefFor(props.page - 1)} rel="prev" class="btn" data-testid="page-prev">
            Previous
          </a>
        </Show>
        <span class="page-info" data-testid="page-info">
          Page {props.page} of {props.totalPages}
        </span>
        <Show
          when={props.page < props.totalPages}
          fallback={<span class="btn disabled">Next</span>}
        >
          <a href={props.hrefFor(props.page + 1)} rel="next" class="btn" data-testid="page-next">
            Next
          </a>
        </Show>
      </nav>
    </Show>
  );
}
