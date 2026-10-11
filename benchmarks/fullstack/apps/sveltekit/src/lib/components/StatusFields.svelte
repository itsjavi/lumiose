<!-- The status form's controls; the page renders the `<form>` (action) around them. -->
<script lang="ts">
  import { STATUSES, STATUS_LABELS, type Status } from "@bench/data/format";

  let { status, pending = false }: { status: Status; pending?: boolean } = $props();
</script>

<label class="field">
  <span class="field-label">Status</span>
  <select name="status" value={status} data-testid="status-select">
    {#each STATUSES as value (value)}
      <option {value}>{STATUS_LABELS[value]}</option>
    {/each}
  </select>
</label>
<button type="submit" class="btn" data-testid="status-submit" disabled={pending}>
  Update status
</button>
