"use server";

import {
  addComment,
  closeIssues,
  createIssue,
  isStatus,
  parseLabels,
  updateIssueStatus,
  validateComment,
  validateIssue,
  validateLogin,
} from "@bench/data";
import type { IssueFormValues } from "@bench/react-ui";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requireUser, startSession } from "./lib/session";

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export interface LoginState {
  username: string;
  error?: string;
}

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const username = text(form, "username");
  const result = validateLogin(username);
  if (!result.ok) return { username, error: result.errors.username };
  await startSession(result.value);
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}

export interface NewIssueState {
  values?: IssueFormValues;
  errors: Partial<Record<keyof IssueFormValues, string>>;
}

export async function createIssueAction(
  _state: NewIssueState,
  form: FormData,
): Promise<NewIssueState> {
  const user = await requireUser();
  const values: IssueFormValues = {
    title: text(form, "title"),
    body: text(form, "body"),
    project: text(form, "project"),
    priority: text(form, "priority"),
    labels: parseLabels(text(form, "labels")),
  };
  const result = validateIssue({ ...values, labels: text(form, "labels") });
  if (!result.ok) return { values, errors: result.errors };
  redirect(`/issues/${createIssue(result.value, user.id)}`);
}

export async function updateStatus(issueId: number, form: FormData): Promise<void> {
  const user = await requireUser();
  const status = form.get("status");
  if (isStatus(status)) updateIssueStatus(issueId, status, user.id);
  refresh();
}

export interface CommentState {
  ok: boolean;
  error?: string;
}

export async function postComment(issueId: number, form: FormData): Promise<CommentState> {
  const user = await requireUser();
  const result = validateComment(form.get("body"));
  if (!result.ok) return { ok: false, error: result.errors.body };
  addComment(issueId, result.value, user.id);
  refresh();
  return { ok: true };
}

export async function closeSelected(form: FormData): Promise<void> {
  const user = await requireUser();
  closeIssues(form.getAll("ids").map(Number), user.id);
  refresh();
}
