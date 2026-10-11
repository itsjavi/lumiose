<script lang="ts">
  import { PRIORITY_LABELS, type Priority } from "@bench/data/format";

  let { priority }: { priority: Priority } = $props();
</script>

<span class="badge priority-{priority}">{PRIORITY_LABELS[priority]}</span>
