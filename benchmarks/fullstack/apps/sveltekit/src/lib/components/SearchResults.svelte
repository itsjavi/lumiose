<script lang="ts">
  import type { SearchHit } from "@bench/data/format";
  import StatusBadge from "./StatusBadge.svelte";

  let { hits }: { hits: SearchHit[] } = $props();
</script>

<ul class="issue-list" data-testid="search-results">
  {#each hits as hit (hit.id)}
    <li class="issue-item" data-testid="search-result">
      <a href="/issues/{hit.id}" class="issue-link"
        ><span class="issue-number">#{hit.id}</span> {hit.title}</a
      >
      <span class="issue-item-meta">
        <StatusBadge status={hit.status} />
        <span class="muted">{hit.project.name}</span>
      </span>
    </li>
  {/each}
</ul>
