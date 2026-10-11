<script setup lang="ts">
defineProps<{ page: number; totalPages: number; hrefFor: (page: number) => string }>();
</script>

<template>
  <nav v-if="totalPages > 1" class="pagination" data-testid="pagination" aria-label="Pagination">
    <NuxtLink v-if="page > 1" :to="hrefFor(page - 1)" rel="prev" class="btn" data-testid="page-prev"
      >Previous</NuxtLink
    >
    <span v-else class="btn disabled">Previous</span>
    <span class="page-info" data-testid="page-info">Page {{ page }} of {{ totalPages }}</span>
    <NuxtLink
      v-if="page < totalPages"
      :to="hrefFor(page + 1)"
      rel="next"
      class="btn"
      data-testid="page-next"
      >Next</NuxtLink
    >
    <span v-else class="btn disabled">Next</span>
  </nav>
</template>
