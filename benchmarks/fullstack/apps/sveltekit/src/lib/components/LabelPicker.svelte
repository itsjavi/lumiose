<!-- Toggle chips that fill a hidden `labels` input with comma-separated label names. -->
<script lang="ts">
  import { LABELS_MAX, type Label } from "@bench/data/format";

  let { labels, defaultValue }: { labels: Label[]; defaultValue: string[] } = $props();

  // The initial selection only: later submissions keep the user's choice.
  // svelte-ignore state_referenced_locally
  let selected = $state(defaultValue);
  const toggle = (name: string) => {
    selected = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name];
  };
</script>

<div class="label-picker" data-testid="label-picker">
  <input type="hidden" name="labels" value={selected.join(",")} />
  {#each labels as label (label.id)}
    {@const on = selected.includes(label.name)}
    <button
      type="button"
      class="chip label-{label.name}"
      aria-pressed={on}
      disabled={!on && selected.length >= LABELS_MAX}
      onclick={() => toggle(label.name)}
      data-testid="label-chip"
    >
      {label.name}
    </button>
  {/each}
</div>
