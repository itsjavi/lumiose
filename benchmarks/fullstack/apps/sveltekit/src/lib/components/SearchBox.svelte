<!--
  The search input with debounced suggestions from `GET /api/search?q=`.
  Rendered inside the page's GET form to /search.
-->
<script lang="ts">
  import type { SearchHit } from "@bench/data/format";

  const SEARCH_DEBOUNCE_MS = 150;

  let { defaultValue }: { defaultValue: string } = $props();

  // The initial value only: the input owns it afterwards.
  // svelte-ignore state_referenced_locally
  let q = $state(defaultValue);
  let hits = $state<SearchHit[]>([]);
  let open = $state(false);

  $effect(() => {
    const term = q.trim();
    if (!term) {
      hits = [];
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (response.ok) hits = await response.json();
      } catch {
        // Aborted by a newer keystroke, or offline: keep the previous suggestions.
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });
</script>

<div class="search-box">
  <input
    type="search"
    name="q"
    bind:value={q}
    oninput={() => (open = true)}
    placeholder="Search issues"
    autocomplete="off"
    aria-label="Search issues"
    data-testid="search-input"
  />
  {#if open && hits.length > 0}
    <ul class="suggestions" data-testid="suggestions">
      {#each hits as hit (hit.id)}
        <li data-testid="suggestion">
          <a href="/issues/{hit.id}"><span class="issue-number">#{hit.id}</span> {hit.title}</a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
