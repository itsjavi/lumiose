<script setup lang="ts">
import type { SearchHit } from "@bench/data/format";

defineProps<{ hits: SearchHit[] }>();
</script>

<template>
  <ul class="issue-list" data-testid="search-results">
    <li v-for="hit in hits" :key="hit.id" class="issue-item" data-testid="search-result">
      <NuxtLink :to="`/issues/${hit.id}`" class="issue-link"
        ><span class="issue-number">#{{ hit.id }}</span> {{ hit.title }}</NuxtLink
      >
      <span class="issue-item-meta">
        <StatusBadge :status="hit.status" />
        <span class="muted">{{ hit.project.name }}</span>
      </span>
    </li>
  </ul>
</template>
