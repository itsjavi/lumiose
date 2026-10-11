<script lang="ts">
  import { formatDate, plural, type Comment } from "@bench/data/format";

  let { comments }: { comments: Comment[] } = $props();
</script>

<p class="muted" data-testid="comment-count">{plural(comments.length, "comment")}</p>
<ol class="comment-list" data-testid="comment-list">
  {#each comments as comment (comment.id)}
    <li class="comment" data-testid="comment">
      <div class="comment-meta">
        <strong>{comment.author.displayName}</strong>
        <time datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
      </div>
      <p class="comment-body">{comment.body}</p>
    </li>
  {/each}
</ol>
