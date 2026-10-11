import {
  STATUSES,
  STATUS_LABELS,
  formatDate,
  plural,
  type Comment,
  type Issue,
} from "@bench/data/format";
import type { Handle } from "remix/component";

import { routes } from "../routes.ts";
import { LabelList, PriorityBadge, StatusBadge } from "./badges.tsx";

export function IssueHeader(handle: Handle<{ issue: Issue }>) {
  return () => {
    const { issue } = handle.props;
    return (
      <header class="issue-header">
        <h1 class="page-title" data-testid="issue-title">
          {issue.title} <span class="issue-number">#{issue.id}</span>
        </h1>
        <div class="issue-meta" data-testid="issue-status">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          <span class="muted">
            in{" "}
            <a href={routes.projects.show.href({ slug: issue.project.slug })}>
              {issue.project.name}
            </a>
          </span>
        </div>
      </header>
    );
  };
}

export function IssueBody(handle: Handle<{ body: string }>) {
  return () => (
    <div class="issue-body" data-testid="issue-body">
      {handle.props.body.split(/\n{2,}/).map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}

export function IssueDetails(handle: Handle<{ issue: Issue }>) {
  return () => {
    const { issue } = handle.props;
    return (
      <dl class="details">
        <dt>Assignee</dt>
        <dd data-testid="assignee">{issue.assignee?.displayName ?? "Unassigned"}</dd>
        <dt>Reporter</dt>
        <dd data-testid="reporter">{issue.reporter.displayName}</dd>
        <dt>Created</dt>
        <dd>
          <time dateTime={issue.createdAt}>{formatDate(issue.createdAt)}</time>
        </dd>
        <dt>Updated</dt>
        <dd>
          <time dateTime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
        </dd>
        <dt>Labels</dt>
        <dd>
          {issue.labels.length ? (
            <LabelList labels={issue.labels} testId="issue-labels" />
          ) : (
            <span class="muted">None</span>
          )}
        </dd>
      </dl>
    );
  };
}

/** The status form's controls; the page renders the `<form>` around them. */
export function StatusFields(handle: Handle<{ status: Issue["status"] }>) {
  return () => (
    <>
      <label class="field">
        <span class="field-label">Status</span>
        <select name="status" data-testid="status-select">
          {STATUSES.map((value) => (
            <option key={value} value={value} selected={value === handle.props.status}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" class="btn" data-testid="status-submit">
        Update status
      </button>
    </>
  );
}

export function CommentList(handle: Handle<{ comments: Comment[] }>) {
  return () => {
    const { comments } = handle.props;
    return (
      <>
        <p class="muted" data-testid="comment-count">
          {plural(comments.length, "comment")}
        </p>
        <ol class="comment-list" data-testid="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} class="comment" data-testid="comment">
              <div class="comment-meta">
                <strong>{comment.author.displayName}</strong>
                <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
              </div>
              <p class="comment-body">{comment.body}</p>
            </li>
          ))}
        </ol>
      </>
    );
  };
}

export function CommentsFallback() {
  return () => (
    <p class="loading" data-testid="comments-loading">
      Loading comments…
    </p>
  );
}
