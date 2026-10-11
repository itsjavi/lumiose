<script lang="ts">
  import {
    PRIORITIES,
    PRIORITY_LABELS,
    STATUSES,
    STATUS_LABELS,
    type Dashboard,
  } from "@bench/data/format";

  let { byStatus, byPriority }: Pick<Dashboard, "byStatus" | "byPriority"> = $props();
</script>

<section class="stats" data-testid="status-stats" aria-label="Issues by status">
  {#each STATUSES as status (status)}
    <div class="stat-card status-{status}" data-testid="stat-{status}">
      <span class="stat-label">{STATUS_LABELS[status]}</span>
      <span class="stat-value">{byStatus[status]}</span>
    </div>
  {/each}
</section>
<section class="stats" data-testid="priority-stats" aria-label="Unresolved issues by priority">
  {#each PRIORITIES as priority (priority)}
    <div class="stat-card priority-{priority}" data-testid="stat-{priority}">
      <span class="stat-label">{PRIORITY_LABELS[priority]}</span>
      <span class="stat-value">{byPriority[priority]}</span>
    </div>
  {/each}
</section>
