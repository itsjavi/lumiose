// The app's data and mutations: `query` functions read, `action`s write, both as server functions
// ("use server") so @bench/data (node:sqlite) only runs on the server. SolidStart revalidates the
// page's queries after every action.
import {
  addComment as insertComment,
  closeIssues,
  createIssue as insertIssue,
  getDashboard as readDashboard,
  getIssue as readIssue,
  getProject,
  isStatus,
  listComments,
  listIssues,
  listLabels,
  listProjects,
  parseIssueFilters,
  parseLabels,
  searchIssues,
  updateIssueStatus,
  validateComment,
  validateIssue,
  validateLogin,
  type IssueField,
} from "@bench/data";
import { action, query, redirect } from "@solidjs/router";
import { currentUser, endSession, requireUser, startSession } from "./session.ts";

export interface IssueFormValues {
  title: string;
  body: string;
  project: string;
  priority: string;
  labels: string[];
}

type SearchRecord = Record<string, string | string[] | undefined>;

const idOf = (value: string): number | undefined =>
  /^\d+$/.test(value) ? Number(value) : undefined;

// ---------------------------------------------------------------- queries

export const getShell = query(async () => {
  "use server";
  return { projects: listProjects(), user: currentUser() };
}, "shell");

export const getDashboard = query(async () => {
  "use server";
  return readDashboard();
}, "dashboard");

/** The project page: undefined for an unknown project. */
export const getProjectIssues = query(async (slug: string, search: SearchRecord) => {
  "use server";
  const project = getProject(slug);
  if (!project) return undefined;
  const filters = parseIssueFilters(search);
  const { items, total } = listIssues({ projectSlug: project.slug, ...filters });
  return { project, filters, items, total, labels: listLabels() };
}, "project-issues");

export const getIssue = query(async (id: string) => {
  "use server";
  const issueId = idOf(id);
  return issueId === undefined ? undefined : readIssue(issueId);
}, "issue");

export const getComments = query(async (id: string) => {
  "use server";
  const issueId = idOf(id);
  return issueId === undefined ? [] : listComments(issueId);
}, "comments");

export const getLabels = query(async () => {
  "use server";
  return listLabels();
}, "labels");

export const getSearchResults = query(async (q: string) => {
  "use server";
  return searchIssues(q);
}, "search");

// ---------------------------------------------------------------- actions

export const login = action(async (form: FormData) => {
  "use server";
  const username = form.get("username");
  const result = validateLogin(username);
  if (!result.ok) return { username: String(username ?? ""), error: result.errors.username };
  startSession(result.value);
  throw redirect("/");
}, "login");

export const logout = action(async () => {
  "use server";
  endSession();
  throw redirect("/");
}, "logout");

export const createIssue = action(async (form: FormData) => {
  "use server";
  const user = requireUser();
  const input = Object.fromEntries(form);
  const result = validateIssue(input);
  if (!result.ok) {
    const values: IssueFormValues = {
      title: String(input.title ?? ""),
      body: String(input.body ?? ""),
      project: String(input.project ?? ""),
      priority: String(input.priority ?? ""),
      labels: parseLabels(input.labels),
    };
    return { errors: result.errors as Partial<Record<IssueField, string>>, values };
  }
  throw redirect(`/issues/${insertIssue(result.value, user.id)}`);
}, "create-issue");

export const updateStatus = action(async (id: number, form: FormData) => {
  "use server";
  const user = requireUser();
  const status = form.get("status");
  if (!isStatus(status)) return { error: "Unknown status." };
  updateIssueStatus(id, status, user.id);
  return { error: undefined };
}, "update-status");

export const addComment = action(async (id: number, form: FormData) => {
  "use server";
  const user = requireUser();
  const result = validateComment(form.get("body"));
  if (!result.ok) return { ok: false, error: result.errors.body };
  insertComment(id, result.value, user.id);
  return { ok: true, error: undefined };
}, "add-comment");

/** Bulk close: the bulk-select form posts the checked `ids`. */
export const closeSelected = action(async (form: FormData) => {
  "use server";
  const user = requireUser();
  return { closed: closeIssues(form.getAll("ids").map(Number), user.id) };
}, "close-selected");
