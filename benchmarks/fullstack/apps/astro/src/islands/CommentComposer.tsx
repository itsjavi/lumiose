import { useEffect, useRef, useState } from "preact/hooks";

/**
 * The comment composer's controls (a Preact island): a textarea with a live character count. The
 * issue page's form posts the comment; the action redirects back to the issue, which loads again
 * with the new comment and an empty composer.
 */
export default function CommentComposer({ max, error }: { max: number; error?: string }) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const form = input.current?.form;
    const submitted = () => setPending(true);
    form?.addEventListener("submit", submitted);
    return () => form?.removeEventListener("submit", submitted);
  }, []);

  return (
    <>
      <label class="field">
        <span class="field-label">Add a comment</span>
        <textarea
          ref={input}
          name="body"
          rows={4}
          maxLength={max}
          value={body}
          onInput={(event) => setBody(event.currentTarget.value)}
          data-testid="comment-input"
        />
      </label>
      {error && (
        <p class="field-error" data-testid="comment-error">
          {error}
        </p>
      )}
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
}
