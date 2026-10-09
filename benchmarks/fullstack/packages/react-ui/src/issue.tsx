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
import { LabelList, PriorityBadge, StatusBadge } from "./badges.tsx";
import type { LinkComponent } from "./link.tsx";

export function IssueHeader({ Link, issue }: { Link: LinkComponent; issue: Issue }) {
  return (
    <header className="issue-header">
      <h1 className="page-title" data-testid="issue-title">
        {issue.title} <span className="issue-number">#{issue.id}</span>
      </h1>
      <div className="issue-meta" data-testid="issue-status">
        <StatusBadge status={issue.status} />
        <PriorityBadge priority={issue.priority} />
        <span className="muted">
          in <Link href={`/projects/${issue.project.slug}`}>{issue.project.name}</Link>
        </span>
      </div>
    </header>
  );
}

export function IssueBody({ body }: { body: string }) {
  return (
    <div className="issue-body" data-testid="issue-body">
      {body.split(/\n{2,}/).map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}

export function IssueDetails({ issue }: { issue: Issue }) {
  return (
    <dl className="details">
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
          <span className="muted">None</span>
        )}
      </dd>
    </dl>
  );
}

/** The status form's controls; the app renders the `<form>` (action) around them. */
export function StatusFields({ status, pending = false }: { status: Status; pending?: boolean }) {
  return (
    <>
      <label className="field">
        <span className="field-label">Status</span>
        <select name="status" defaultValue={status} data-testid="status-select">
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn" data-testid="status-submit" disabled={pending}>
        Update status
      </button>
    </>
  );
}

export function CommentList({ comments }: { comments: Comment[] }) {
  return (
    <>
      <p className="muted" data-testid="comment-count">
        {plural(comments.length, "comment")}
      </p>
      <ol className="comment-list" data-testid="comment-list">
        {comments.map((comment) => (
          <li key={comment.id} className="comment" data-testid="comment">
            <div className="comment-meta">
              <strong>{comment.author.displayName}</strong>{" "}
              <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
            </div>
            <p className="comment-body">{comment.body}</p>
          </li>
        ))}
      </ol>
    </>
  );
}

export function CommentsFallback() {
  return (
    <p className="loading" data-testid="comments-loading">
      Loading comments…
    </p>
  );
}

export interface CommentFieldsProps {
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  error?: string;
}

/** The comment composer's controls with a live character count; the app owns the form and its submission. */
export function CommentFields({ value, onChange, pending, error }: CommentFieldsProps) {
  return (
    <>
      <label className="field">
        <span className="field-label">Add a comment</span>
        <textarea
          name="body"
          rows={4}
          maxLength={COMMENT_MAX}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-testid="comment-input"
        />
      </label>
      {error && (
        <p className="field-error" data-testid="comment-error">
          {error}
        </p>
      )}
      <div className="composer-footer">
        <span className="char-count" data-testid="char-count">
          {value.length} / {COMMENT_MAX}
        </span>
        <button
          type="submit"
          className="btn btn-primary"
          data-testid="comment-submit"
          disabled={pending || value.trim().length === 0}
        >
          {pending ? "Posting…" : "Comment"}
        </button>
      </div>
    </>
  );
}
