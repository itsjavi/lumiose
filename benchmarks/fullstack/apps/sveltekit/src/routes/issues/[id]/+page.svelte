<script lang="ts">
  import { enhance } from "$app/forms";
  import CommentFields from "#lib/components/CommentFields.svelte";
  import CommentList from "#lib/components/CommentList.svelte";
  import CommentsFallback from "#lib/components/CommentsFallback.svelte";
  import IssueBody from "#lib/components/IssueBody.svelte";
  import IssueDetails from "#lib/components/IssueDetails.svelte";
  import IssueHeader from "#lib/components/IssueHeader.svelte";
  import StatusFields from "#lib/components/StatusFields.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  let body = $state("");
  let posting = $state(false);
  let updating = $state(false);
</script>

<svelte:head>
  <title>#{data.issue.id} {data.issue.title} · Tracker</title>
</svelte:head>

<IssueHeader issue={data.issue} />
<div class="issue-layout">
  <div class="issue-main">
    <IssueBody body={data.issue.body} />
    <section class="comments" aria-label="Comments">
      <h2 class="panel-title">Comments</h2>
      {#await data.comments}
        <CommentsFallback />
      {:then comments}
        <CommentList {comments} />
      {/await}
      <!-- Textarea with a live character count; posts the action and clears itself on success. -->
      <form
        method="POST"
        action="?/comment"
        class="comment-form"
        use:enhance={() => {
          posting = true;
          return async ({ result, update }) => {
            await update({ reset: false });
            if (result.type === "success") body = "";
            posting = false;
          };
        }}
      >
        <CommentFields bind:value={body} pending={posting} error={form?.comment?.error} />
      </form>
    </section>
  </div>
  <aside class="issue-side">
    <IssueDetails issue={data.issue} />
    <form
      method="POST"
      action="?/status"
      class="status-form"
      use:enhance={() => {
        updating = true;
        return async ({ update }) => {
          await update({ reset: false });
          updating = false;
        };
      }}
    >
      <StatusFields status={data.issue.status} pending={updating} />
    </form>
  </aside>
</div>
