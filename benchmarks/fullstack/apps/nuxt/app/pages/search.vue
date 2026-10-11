<script setup lang="ts">
const route = useRoute();
const q = computed(() => (typeof route.query.q === "string" ? route.query.q.trim() : ""));
const { data: hits } = await useFetch("/api/search", { query: { q, limit: 20 } });

useHead({ title: "Search" });

// A client-side navigation, as the other routers do for GET forms.
function search(event: Event) {
  const form = new FormData(event.target as HTMLFormElement);
  return navigateTo({ path: "/search", query: { q: String(form.get("q") ?? "") } });
}
</script>

<template>
  <h1 class="page-title">Search</h1>
  <form method="get" action="/search" class="search-form" role="search" @submit.prevent="search">
    <SearchBox :key="q" :default-value="q" />
  </form>
  <SearchResults v-if="q && hits" :hits="hits" />
</template>
