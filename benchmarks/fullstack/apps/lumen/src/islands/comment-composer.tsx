// Island: the comment form with a live character count. `submit` posts it to the page's `comment`
// action without a page load; the action redirects back to the issue, so the new comment appears.
import { COMMENT_MAX } from "@bench/data/format";
import { actionData, onMount, signal, submit, submitting } from "lumen";
import { markReady } from "../lib/ready.ts";
import type { actions } from "../routes/issues/[id].tsx";

export interface CommentFailure {
  error: string;
}

const error = () => actionData<typeof actions.comment>()?.error;

export function CommentComposer() {
  const body = signal("");
  onMount(markReady);

  return (
    <form method="post" action="?/comment" class="comment-form" onSubmit={submit}>
      <label class="field">
        <span class="field-label">Add a comment</span>
        <textarea
          name="body"
          rows={4}
          maxlength={COMMENT_MAX}
          bind:value={body}
          data-testid="comment-input"
        />
      </label>
      {error() && (
        <p class="field-error" data-testid="comment-error">
          {error()}
        </p>
      )}
      <div class="composer-footer">
        <span class="char-count" data-testid="char-count">
          {body().length} / {COMMENT_MAX}
        </span>
        <button
          type="submit"
          class="btn btn-primary"
          data-testid="comment-submit"
          disabled={submitting("comment") || body().trim().length === 0}
        >
          {submitting("comment") ? "Posting…" : "Comment"}
        </button>
      </div>
    </form>
  );
}
