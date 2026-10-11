<script lang="ts">
  import { STATUS_LABELS, type Status } from "@bench/data/format";

  let { status }: { status: Status } = $props();
</script>

<span class="badge status-{status}">{STATUS_LABELS[status]}</span>
