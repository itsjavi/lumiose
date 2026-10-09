// The issue page's parts: the markup of @bench/react-ui's issue.tsx.
import {
  STATUSES,
  STATUS_LABELS,
  formatDate,
  plural,
  type Comment,
  type Issue,
  type Status,
} from "@bench/data/format";
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
      {props.body.split(/\n{2,}/).map((paragraph) => (
        <p>{paragraph}</p>
      ))}
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
        {props.issue.labels.length ? (
          <LabelList labels={props.issue.labels} testId="issue-labels" />
        ) : (
          <span class="muted">None</span>
        )}
      </dd>
    </dl>
  );
}

/** The status form's controls; the page renders the `<form>` around them. */
export function StatusFields(props: { status: Status }) {
  return (
    <>
      <label class="field">
        <span class="field-label">Status</span>
        <select name="status" data-testid="status-select">
          {STATUSES.map((value) => (
            <option value={value} selected={value === props.status}>
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

export function CommentList(props: { comments: Comment[] }) {
  return (
    <>
      <p class="muted" data-testid="comment-count">
        {plural(props.comments.length, "comment")}
      </p>
      <ol class="comment-list" data-testid="comment-list">
        {props.comments.map((comment) => (
          <li class="comment" data-testid="comment">
            <div class="comment-meta">
              <strong>{comment.author.displayName}</strong>{" "}
              <time datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
            </div>
            <p class="comment-body">{comment.body}</p>
          </li>
        ))}
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
