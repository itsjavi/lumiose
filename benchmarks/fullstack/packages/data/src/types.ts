export const STATUSES = ["open", "in_progress", "closed"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const SORTS = ["updated", "created", "priority"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Sort = (typeof SORTS)[number];

export const isStatus = (value: unknown): value is Status => STATUSES.includes(value as Status);
export const isPriority = (value: unknown): value is Priority =>
  PRIORITIES.includes(value as Priority);

export const PAGE_SIZE = 50;
export const TITLE_MAX = 120;
export const BODY_MAX = 5000;
export const COMMENT_MAX = 2000;
export const LABELS_MAX = 3;

export interface User {
  id: number;
  /** Login handle, e.g. "alice". */
  name: string;
  displayName: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  openCount: number;
}

export interface ProjectRef {
  slug: string;
  name: string;
}

/** One row of an issue list (project table, dashboard, search). */
export interface IssueSummary {
  id: number;
  title: string;
  status: Status;
  priority: Priority;
  project: ProjectRef;
  assignee: User | null;
  labels: Label[];
  commentCount: number;
  /** ISO 8601, UTC. */
  createdAt: string;
  /** ISO 8601, UTC. */
  updatedAt: string;
}

export interface Issue extends IssueSummary {
  body: string;
  reporter: User;
}

export interface Comment {
  id: number;
  issueId: number;
  body: string;
  author: User;
  createdAt: string;
}

export interface ProjectStats {
  slug: string;
  name: string;
  open: number;
  inProgress: number;
  closed: number;
  total: number;
}

export interface Dashboard {
  byStatus: Record<Status, number>;
  /** Counts of issues that are not closed, by priority. */
  byPriority: Record<Priority, number>;
  projects: ProjectStats[];
  recent: IssueSummary[];
}

export interface IssueQuery {
  projectSlug?: string;
  status?: Status;
  priority?: Priority;
  label?: string;
  q?: string;
  sort?: Sort;
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

export interface IssuePage {
  items: IssueSummary[];
  total: number;
}

export interface SearchHit {
  id: number;
  title: string;
  status: Status;
  project: ProjectRef;
}

/** Raw issue form input, as read from form data. */
export interface IssueInput {
  title?: unknown;
  body?: unknown;
  project?: unknown;
  priority?: unknown;
  /** Comma-separated label names (the label picker's hidden input) or a list of names. */
  labels?: unknown;
}

export interface NewIssue {
  title: string;
  body: string;
  projectSlug: string;
  priority: Priority;
  labels: string[];
}

export type IssueField = "title" | "body" | "project" | "priority" | "labels";

export type Validation<T, F extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: Partial<Record<F, string>> };
