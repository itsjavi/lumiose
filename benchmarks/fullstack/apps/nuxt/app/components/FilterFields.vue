<!-- The controls of the project page's GET filter form; the page renders the `<form>` itself. -->
<script setup lang="ts">
import {
  PRIORITIES,
  PRIORITY_LABELS,
  SORTS,
  SORT_LABELS,
  STATUSES,
  STATUS_LABELS,
  type IssueFilters,
  type Label,
} from "@bench/data/format";

defineProps<{ filters: IssueFilters; labels: Label[] }>();
</script>

<template>
  <label class="filter">
    <span>Status</span>
    <select name="status">
      <option value="">Any</option>
      <option
        v-for="status in STATUSES"
        :key="status"
        :value="status"
        :selected="status === filters.status"
      >
        {{ STATUS_LABELS[status] }}
      </option>
    </select>
  </label>
  <label class="filter">
    <span>Priority</span>
    <select name="priority">
      <option value="">Any</option>
      <option
        v-for="priority in PRIORITIES"
        :key="priority"
        :value="priority"
        :selected="priority === filters.priority"
      >
        {{ PRIORITY_LABELS[priority] }}
      </option>
    </select>
  </label>
  <label class="filter">
    <span>Label</span>
    <select name="label">
      <option value="">Any</option>
      <option
        v-for="label in labels"
        :key="label.id"
        :value="label.name"
        :selected="label.name === filters.label"
      >
        {{ label.name }}
      </option>
    </select>
  </label>
  <label class="filter">
    <span>Sort</span>
    <select name="sort">
      <option v-for="sort in SORTS" :key="sort" :value="sort" :selected="sort === filters.sort">
        {{ SORT_LABELS[sort] }}
      </option>
    </select>
  </label>
  <label class="filter filter-q">
    <span>Title</span>
    <input type="search" name="q" :value="filters.q ?? ''" placeholder="Filter by title" />
  </label>
  <button type="submit" class="btn" data-testid="filter-submit">Apply</button>
</template>
