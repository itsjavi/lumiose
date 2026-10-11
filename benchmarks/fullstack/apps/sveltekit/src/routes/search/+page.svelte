<script lang="ts">
  import SearchBox from "#lib/components/SearchBox.svelte";
  import SearchResults from "#lib/components/SearchResults.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Search · Tracker</title>
</svelte:head>

<h1 class="page-title">Search</h1>
<form method="GET" action="/search" class="search-form" role="search">
  {#key data.q}
    <SearchBox defaultValue={data.q} />
  {/key}
</form>
{#if data.q}
  <SearchResults hits={data.hits} />
{/if}
