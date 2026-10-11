import { clientEntry, on, ref, type Handle } from "remix/component";

/**
 * The comment composer's controls (doc-4 §2): a textarea with a live character count. The page's
 * form posts the comment as a frame navigation; the action redirects back to the issue, whose
 * frames reload with the new comment, and the composer clears itself.
 */
export const CommentComposer = clientEntry(
  import.meta.url,
  function CommentComposer(handle: Handle<{ max: number; error?: string }>) {
    let body = "";
    let pending = false;

    handle.frame.addEventListener(
      "reloadComplete",
      () => {
        // A failed submission renders the error and keeps the text; a saved one starts over.
        if (pending && !handle.props.error) body = "";
        pending = false;
        handle.update();
      },
      { signal: handle.signal },
    );

    return () => {
      const { max, error } = handle.props;
      return (
        <>
          <label class="field">
            <span class="field-label">Add a comment</span>
            <textarea
              name="body"
              rows={4}
              maxLength={max}
              value={body}
              data-testid="comment-input"
              mix={[
                on("input", (event) => {
                  body = event.currentTarget.value;
                  handle.update();
                }),
                ref((node, signal) => {
                  node.form?.addEventListener(
                    "submit",
                    () => {
                      pending = true;
                      handle.update();
                    },
                    { signal },
                  );
                }),
              ]}
            ></textarea>
          </label>
          {error ? (
            <p class="field-error" data-testid="comment-error">
              {error}
            </p>
          ) : null}
          <div class="composer-footer">
            <span class="char-count" data-testid="char-count">
              {body.length} / {max}
            </span>
            <button
              type="submit"
              class="btn btn-primary"
              data-testid="comment-submit"
              disabled={pending || body.trim().length === 0}
            >
              {pending ? "Posting…" : "Comment"}
            </button>
          </div>
        </>
      );
    };
  },
);
