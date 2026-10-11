<!--
  The search input with debounced suggestions from `GET /api/search?q=`.
  Rendered inside the page's GET form to /search.
-->
<script setup lang="ts">
import type { SearchHit } from "@bench/data/format";

const SEARCH_DEBOUNCE_MS = 150;

const props = defineProps<{ defaultValue: string }>();

// The initial value only: the input owns it afterwards.
const q = ref(props.defaultValue);
const hits = ref<SearchHit[]>([]);
const open = ref(false);

watch(q, (value, _, onCleanup) => {
  const term = value.trim();
  if (!term) {
    hits.value = [];
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(async () => {
    try {
      hits.value = await $fetch("/api/search", { query: { q: term }, signal: controller.signal });
    } catch {
      // Aborted by a newer keystroke, or offline: keep the previous suggestions.
    }
  }, SEARCH_DEBOUNCE_MS);
  onCleanup(() => {
    clearTimeout(timer);
    controller.abort();
  });
});
</script>

<template>
  <div class="search-box">
    <input
      v-model="q"
      type="search"
      name="q"
      placeholder="Search issues"
      autocomplete="off"
      aria-label="Search issues"
      data-testid="search-input"
      @input="open = true"
    />
    <ul v-if="open && hits.length > 0" class="suggestions" data-testid="suggestions">
      <li v-for="hit in hits" :key="hit.id" data-testid="suggestion">
        <NuxtLink :to="`/issues/${hit.id}`"
          ><span class="issue-number">#{{ hit.id }}</span> {{ hit.title }}</NuxtLink
        >
      </li>
    </ul>
  </div>
</template>
