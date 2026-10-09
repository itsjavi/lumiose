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
import { PageTitle } from "./Layout.tsx";
import type { LinkComponent } from "./link.tsx";

export function IssueHeader({ Link, issue }: { Link: LinkComponent; issue: Issue }) {
  return (
    <header className="issue-header">
      <PageTitle>{issue.title}</PageTitle>
      <div className="issue-meta">
        <span className="issue-number">#{issue.id}</span>
        <StatusBadge status={issue.status} testId="issue-status" />
        <PriorityBadge priority={issue.priority} testId="issue-priority" />
        <span className="muted">
          in{" "}
          <Link href={`/projects/${issue.project.slug}`} data-testid="issue-project">
            {issue.project.name}
          </Link>
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
      <dd data-testid="issue-assignee">{issue.assignee?.name ?? "Unassigned"}</dd>
      <dt>Reporter</dt>
      <dd data-testid="issue-reporter">{issue.reporter.name}</dd>
      <dt>Created</dt>
      <dd>
        <time dateTime={issue.createdAt} data-testid="issue-created">
          {formatDate(issue.createdAt)}
        </time>
      </dd>
      <dt>Updated</dt>
      <dd>
        <time dateTime={issue.updatedAt} data-testid="issue-updated">
          {formatDate(issue.updatedAt)}
        </time>
      </dd>
      <dt>Labels</dt>
      <dd>
        <LabelList labels={issue.labels} testId="issue-labels" />
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
        <select name="status" defaultValue={status}>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn" disabled={pending}>
        Update status
      </button>
    </>
  );
}

export function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return (
      <p className="muted" data-testid="comments-empty">
        No comments yet.
      </p>
    );
  }
  return (
    <>
      <p className="muted">{plural(comments.length, "comment")}</p>
      <ol className="comment-list" data-testid="comment-list">
        {comments.map((comment) => (
          <li key={comment.id} className="comment" data-testid="comment">
            <div className="comment-meta">
              <strong data-testid="comment-author">{comment.author.name}</strong>{" "}
              <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
            </div>
            <p className="comment-body" data-testid="comment-body">
              {comment.body}
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}

export function CommentsFallback() {
  return (
    <p className="loading" data-testid="comments-fallback">
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
        />
      </label>
      {error && (
        <p className="field-error" data-testid="field-error-body">
          {error}
        </p>
      )}
      <div className="composer-footer">
        <span className="char-count" data-testid="char-count">
          {value.length} / {COMMENT_MAX}
        </span>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Comment
        </button>
      </div>
    </>
  );
}
