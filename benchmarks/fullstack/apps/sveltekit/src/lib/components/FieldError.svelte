<script lang="ts">
  let { name, error }: { name: string; error: string | undefined } = $props();
</script>

{#if error}
  <p class="field-error" id="{name}-error" data-testid="error-{name}">{error}</p>
{/if}
