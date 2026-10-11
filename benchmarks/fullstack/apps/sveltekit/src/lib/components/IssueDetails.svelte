<script lang="ts">
  import { formatDate, type Issue } from "@bench/data/format";
  import LabelList from "./LabelList.svelte";

  let { issue }: { issue: Issue } = $props();
</script>

<dl class="details">
  <dt>Assignee</dt>
  <dd data-testid="assignee">{issue.assignee?.displayName ?? "Unassigned"}</dd>
  <dt>Reporter</dt>
  <dd data-testid="reporter">{issue.reporter.displayName}</dd>
  <dt>Created</dt>
  <dd><time datetime={issue.createdAt}>{formatDate(issue.createdAt)}</time></dd>
  <dt>Updated</dt>
  <dd><time datetime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time></dd>
  <dt>Labels</dt>
  <dd>
    {#if issue.labels.length}
      <LabelList labels={issue.labels} testId="issue-labels" />
    {:else}
      <span class="muted">None</span>
    {/if}
  </dd>
</dl>
