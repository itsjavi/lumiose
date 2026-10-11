<!-- A compact list of issues (the dashboard's "recently updated", testId `recent-issues`). -->
<script lang="ts">
  import { formatDate, type IssueSummary } from "@bench/data/format";
  import PriorityBadge from "./PriorityBadge.svelte";
  import StatusBadge from "./StatusBadge.svelte";

  let { issues, testId }: { issues: IssueSummary[]; testId: string } = $props();
</script>

<ul class="issue-list" data-testid={testId}>
  {#each issues as issue (issue.id)}
    <li class="issue-item">
      <a href="/issues/{issue.id}" class="issue-link"
        ><span class="issue-number">#{issue.id}</span> {issue.title}</a
      >
      <span class="issue-item-meta">
        <StatusBadge status={issue.status} />
        <PriorityBadge priority={issue.priority} />
        <span class="muted">{issue.project.name}</span>
        <time datetime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time>
      </span>
    </li>
  {/each}
</ul>
