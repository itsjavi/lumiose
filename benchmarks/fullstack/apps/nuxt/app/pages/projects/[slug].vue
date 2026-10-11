<script setup lang="ts">
import { PAGE_SIZE, issueListHref, plural } from "@bench/data/format";

const route = useRoute();
const { data, error } = await useFetch(() => `/api/projects/${String(route.params.slug)}/issues`, {
  query: computed(() => route.query),
});
if (error.value) throw createError({ ...error.value, fatal: true });

useHead({ title: () => data.value?.project.name ?? "" });

const selected = ref<ReadonlySet<number>>(new Set());
const pending = ref(false);

const toggleAll = () => {
  const items = data.value?.items ?? [];
  selected.value = items.every((issue) => selected.value.has(issue.id))
    ? new Set()
    : new Set(items.map((issue) => issue.id));
};
const toggle = (id: number) => {
  const next = new Set(selected.value);
  if (!next.delete(id)) next.add(id);
  selected.value = next;
};

// GET forms become client-side navigations (the filters go to the URL, the data refetches).
function applyFilters(event: Event) {
  const form = new URLSearchParams(new FormData(event.target as HTMLFormElement) as never);
  return navigateTo(`${route.path}?${form}`);
}

/** Bulk close, then reload the list and the sidebar's counts. */
async function closeSelected() {
  const ids = [...selected.value];
  selected.value = new Set();
  pending.value = true;
  try {
    if (await postAction("/api/issues/close", { ids })) await refreshNuxtData();
  } finally {
    pending.value = false;
  }
}

watch(
  () => route.query,
  () => (selected.value = new Set()),
);
</script>

<template>
  <template v-if="data">
    <header class="page-header">
      <h1 class="page-title">{{ data.project.name }}</h1>
      <p class="muted" data-testid="issue-total">{{ plural(data.total, "issue") }}</p>
    </header>
    <form method="get" class="filters" @submit.prevent="applyFilters">
      <FilterFields :key="route.fullPath" :filters="data.filters" :labels="data.labels" />
    </form>
    <form class="bulk-form" @submit.prevent="closeSelected">
      <IssueTable
        :issues="data.items"
        :selected="selected"
        @toggle="toggle"
        @toggle-all="toggleAll"
      />
      <BulkBar :count="selected.size" :pending="pending" />
    </form>
    <Pagination
      :page="data.filters.page"
      :total-pages="Math.max(1, Math.ceil(data.total / PAGE_SIZE))"
      :href-for="(n: number) => issueListHref(data!.project.slug, data!.filters, { page: n })"
    />
  </template>
</template>
