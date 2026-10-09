// Framework-agnostic helpers shared by every app, so they render the same text and URLs.
// Client-safe: no database access (import it as "@bench/data/format" from client components).
import { SORTS, isPriority, isStatus, type Priority, type Sort, type Status } from "./types.ts";

export * from "./types.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 1, 2026" in UTC, identical on server and client. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  closed: "Closed",
};
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
export const SORT_LABELS: Record<Sort, string> = {
  updated: "Recently updated",
  created: "Newest",
  priority: "Priority",
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The session cookie: `uid=<userId>`, unsigned (this is a benchmark). */
export const SESSION_COOKIE = "uid";

// ---------------------------------------------------------------- project issue filters

export interface IssueFilters {
  status?: Status;
  priority?: Priority;
  label?: string;
  q?: string;
  sort: Sort;
  page: number;
}

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function param(params: Params, key: string): string | undefined {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

/** Reads the project page's filters from its query string; invalid values are ignored. */
export function parseIssueFilters(params: Params): IssueFilters {
  const status = param(params, "status");
  const priority = param(params, "priority");
  const sort = param(params, "sort");
  const page = Number(param(params, "page"));
  return {
    status: isStatus(status) ? status : undefined,
    priority: isPriority(priority) ? priority : undefined,
    label: param(params, "label"),
    q: param(params, "q"),
    sort: SORTS.includes(sort as Sort) ? (sort as Sort) : "updated",
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
  };
}

/** The canonical project page URL for `filters`; defaults are omitted. */
export function issueListHref(
  slug: string,
  filters: IssueFilters,
  patch: Partial<IssueFilters> = {},
): string {
  const merged = { ...filters, ...patch };
  const search = new URLSearchParams();
  if (merged.status) search.set("status", merged.status);
  if (merged.priority) search.set("priority", merged.priority);
  if (merged.label) search.set("label", merged.label);
  if (merged.q) search.set("q", merged.q);
  if (merged.sort !== "updated") search.set("sort", merged.sort);
  if (merged.page > 1) search.set("page", String(merged.page));
  const query = search.toString();
  return `/projects/${slug}${query ? `?${query}` : ""}`;
}
