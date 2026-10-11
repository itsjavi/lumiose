<script lang="ts">
  import type { Snippet } from "svelte";
  import FieldError from "./FieldError.svelte";

  let {
    name,
    label,
    error,
    children,
  }: { name: string; label: string; error?: string; children: Snippet } = $props();
</script>

<div class={error ? "field has-error" : "field"}>
  <label class="field-label" for={name}>{label}</label>
  {@render children()}
  <FieldError {name} {error} />
</div>
