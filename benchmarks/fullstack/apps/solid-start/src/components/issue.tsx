import {
  COMMENT_MAX,
  STATUSES,
  STATUS_LABELS,
  formatDate,
  plural,
  type Comment,
  type Issue,
  type Status,
} from "@bench/data/format";
import { For, Show } from "solid-js";
import { LabelList, PriorityBadge, StatusBadge } from "./badges.tsx";

export function IssueHeader(props: { issue: Issue }) {
  return (
    <header class="issue-header">
      <h1 class="page-title" data-testid="issue-title">
        {props.issue.title} <span class="issue-number">#{props.issue.id}</span>
      </h1>
      <div class="issue-meta" data-testid="issue-status">
        <StatusBadge status={props.issue.status} />
        <PriorityBadge priority={props.issue.priority} />
        <span class="muted">
          in <a href={`/projects/${props.issue.project.slug}`}>{props.issue.project.name}</a>
        </span>
      </div>
    </header>
  );
}

export function IssueBody(props: { body: string }) {
  return (
    <div class="issue-body" data-testid="issue-body">
      <For each={props.body.split(/\n{2,}/)}>{(paragraph) => <p>{paragraph}</p>}</For>
    </div>
  );
}

export function IssueDetails(props: { issue: Issue }) {
  return (
    <dl class="details">
      <dt>Assignee</dt>
      <dd data-testid="assignee">{props.issue.assignee?.displayName ?? "Unassigned"}</dd>
      <dt>Reporter</dt>
      <dd data-testid="reporter">{props.issue.reporter.displayName}</dd>
      <dt>Created</dt>
      <dd>
        <time datetime={props.issue.createdAt}>{formatDate(props.issue.createdAt)}</time>
      </dd>
      <dt>Updated</dt>
      <dd>
        <time datetime={props.issue.updatedAt}>{formatDate(props.issue.updatedAt)}</time>
      </dd>
      <dt>Labels</dt>
      <dd>
        <Show when={props.issue.labels.length} fallback={<span class="muted">None</span>}>
          <LabelList labels={props.issue.labels} testId="issue-labels" />
        </Show>
      </dd>
    </dl>
  );
}

/** The status form's controls; the page renders the `<form>` (action) around them. */
export function StatusFields(props: { status: Status; pending?: boolean }) {
  return (
    <>
      <label class="field">
        <span class="field-label">Status</span>
        <select name="status" data-testid="status-select">
          <For each={STATUSES}>
            {(value) => (
              <option value={value} selected={props.status === value}>
                {STATUS_LABELS[value]}
              </option>
            )}
          </For>
        </select>
      </label>
      <button type="submit" class="btn" data-testid="status-submit" disabled={props.pending}>
        Update status
      </button>
    </>
  );
}

export function CommentList(props: { comments: Comment[] }) {
  return (
    <>
      <p class="muted" data-testid="comment-count">
        {plural(props.comments.length, "comment")}
      </p>
      <ol class="comment-list" data-testid="comment-list">
        <For each={props.comments}>
          {(comment) => (
            <li class="comment" data-testid="comment">
              <div class="comment-meta">
                <strong>{comment.author.displayName}</strong>{" "}
                <time datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
              </div>
              <p class="comment-body">{comment.body}</p>
            </li>
          )}
        </For>
      </ol>
    </>
  );
}

export function CommentsFallback() {
  return (
    <p class="loading" data-testid="comments-loading">
      Loading comments…
    </p>
  );
}

export interface CommentFieldsProps {
  value: string;
  onInput: (value: string) => void;
  pending: boolean;
  error?: string;
}

/** The comment composer's controls with a live character count; the page owns the form. */
export function CommentFields(props: CommentFieldsProps) {
  return (
    <>
      <label class="field">
        <span class="field-label">Add a comment</span>
        <textarea
          name="body"
          rows={4}
          maxLength={COMMENT_MAX}
          value={props.value}
          onInput={(event) => props.onInput(event.currentTarget.value)}
          data-testid="comment-input"
        />
      </label>
      <Show when={props.error}>
        <p class="field-error" data-testid="comment-error">
          {props.error}
        </p>
      </Show>
      <div class="composer-footer">
        <span class="char-count" data-testid="char-count">
          {props.value.length} / {COMMENT_MAX}
        </span>
        <button
          type="submit"
          class="btn btn-primary"
          data-testid="comment-submit"
          disabled={props.pending || props.value.trim().length === 0}
        >
          {props.pending ? "Posting…" : "Comment"}
        </button>
      </div>
    </>
  );
}
