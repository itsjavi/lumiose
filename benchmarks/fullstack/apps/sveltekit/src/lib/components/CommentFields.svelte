<!-- The comment composer's controls with a live character count; the page owns the form. -->
<script lang="ts">
  import { COMMENT_MAX } from "@bench/data/format";

  let {
    value = $bindable(),
    pending,
    error,
  }: { value: string; pending: boolean; error?: string } = $props();
</script>

<label class="field">
  <span class="field-label">Add a comment</span>
  <textarea name="body" rows="4" maxlength={COMMENT_MAX} bind:value data-testid="comment-input"
  ></textarea>
</label>
{#if error}
  <p class="field-error" data-testid="comment-error">{error}</p>
{/if}
<div class="composer-footer">
  <span class="char-count" data-testid="char-count">{value.length} / {COMMENT_MAX}</span>
  <button
    type="submit"
    class="btn btn-primary"
    data-testid="comment-submit"
    disabled={pending || value.trim().length === 0}
  >
    {pending ? "Posting…" : "Comment"}
  </button>
</div>
