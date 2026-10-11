<script lang="ts">
  import { page } from "$app/state";
  import NotFound from "#lib/components/NotFound.svelte";
</script>

<svelte:head>
  <title>{page.status === 404 ? "Not found" : "Error"} · Tracker</title>
</svelte:head>

{#if page.status === 404}
  <NotFound />
{:else}
  <h1 class="page-title">Something went wrong</h1>
  <p class="muted">{page.status} {page.error?.message ?? "Unexpected error"}</p>
{/if}
