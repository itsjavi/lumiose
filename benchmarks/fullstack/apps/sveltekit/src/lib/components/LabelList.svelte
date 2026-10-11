<script lang="ts">
  import type { Label } from "@bench/data/format";

  let { labels, testId }: { labels: Label[]; testId?: string } = $props();
</script>

{#if labels.length > 0}
  <ul class="labels" data-testid={testId}>
    {#each labels as label (label.id)}
      <li class="label label-{label.name}">{label.name}</li>
    {/each}
  </ul>
{/if}
