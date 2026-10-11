<script lang="ts">
  import type { Issue } from "@bench/data/format";
  import PriorityBadge from "./PriorityBadge.svelte";
  import StatusBadge from "./StatusBadge.svelte";

  let { issue }: { issue: Issue } = $props();
</script>

<header class="issue-header">
  <h1 class="page-title" data-testid="issue-title">
    {issue.title} <span class="issue-number">#{issue.id}</span>
  </h1>
  <div class="issue-meta" data-testid="issue-status">
    <StatusBadge status={issue.status} />
    <PriorityBadge priority={issue.priority} />
    <span class="muted">in <a href="/projects/{issue.project.slug}">{issue.project.name}</a></span>
  </div>
</header>
