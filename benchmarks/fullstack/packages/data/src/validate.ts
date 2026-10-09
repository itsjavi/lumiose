import { getProject, getUserByName, listLabels } from "./queries.ts";
import {
  BODY_MAX,
  COMMENT_MAX,
  LABELS_MAX,
  TITLE_MAX,
  isPriority,
  type IssueField,
  type IssueInput,
  type NewIssue,
  type User,
  type Validation,
} from "./types.ts";

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Splits the label picker's comma-separated value (or a list of names) into unique names. */
export function parseLabels(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.flatMap((v) => str(v).split(","))
    : str(value).split(",");
  return [...new Set(parts.map((part) => part.trim()).filter(Boolean))];
}

/** Validates the new-issue form. Error messages are shared so every app renders the same text. */
export function validateIssue(input: IssueInput): Validation<NewIssue, IssueField> {
  const errors: Partial<Record<IssueField, string>> = {};

  const title = str(input.title);
  if (!title) errors.title = "Title is required.";
  else if (title.length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.length > TITLE_MAX)
    errors.title = `Title must be at most ${TITLE_MAX} characters.`;

  const body = str(input.body);
  if (body.length > BODY_MAX) errors.body = `Description must be at most ${BODY_MAX} characters.`;

  const projectSlug = str(input.project);
  if (!projectSlug) errors.project = "Choose a project.";
  else if (!getProject(projectSlug)) errors.project = "Unknown project.";

  const priority = str(input.priority);
  if (!isPriority(priority)) errors.priority = "Choose a priority.";

  const labels = parseLabels(input.labels);
  const known = new Set(listLabels().map((label) => label.name));
  const unknown = labels.filter((name) => !known.has(name));
  if (unknown.length) errors.labels = `Unknown label: ${unknown.join(", ")}.`;
  else if (labels.length > LABELS_MAX) errors.labels = `Choose at most ${LABELS_MAX} labels.`;

  if (Object.keys(errors).length > 0 || !isPriority(priority)) return { ok: false, errors };
  return { ok: true, value: { title, body, projectSlug, priority, labels } };
}

/** Validates a comment body. */
export function validateComment(body: unknown): Validation<string, "body"> {
  const value = str(body);
  if (!value) return { ok: false, errors: { body: "Comment cannot be empty." } };
  if (value.length > COMMENT_MAX) {
    return { ok: false, errors: { body: `Comment must be at most ${COMMENT_MAX} characters.` } };
  }
  return { ok: true, value };
}

/** Resolves the login form's username to a user. */
export function validateLogin(username: unknown): Validation<User, "username"> {
  const name = str(username);
  if (!name) return { ok: false, errors: { username: "Enter a username." } };
  const user = getUserByName(name);
  if (!user) return { ok: false, errors: { username: "Unknown user." } };
  return { ok: true, value: user };
}
