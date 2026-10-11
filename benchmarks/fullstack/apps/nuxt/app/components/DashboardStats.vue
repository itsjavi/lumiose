<script setup lang="ts">
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Dashboard,
} from "@bench/data/format";

defineProps<Pick<Dashboard, "byStatus" | "byPriority">>();
</script>

<template>
  <section class="stats" data-testid="status-stats" aria-label="Issues by status">
    <div
      v-for="status in STATUSES"
      :key="status"
      :class="`stat-card status-${status}`"
      :data-testid="`stat-${status}`"
    >
      <span class="stat-label">{{ STATUS_LABELS[status] }}</span>
      <span class="stat-value">{{ byStatus[status] }}</span>
    </div>
  </section>
  <section class="stats" data-testid="priority-stats" aria-label="Unresolved issues by priority">
    <div
      v-for="priority in PRIORITIES"
      :key="priority"
      :class="`stat-card priority-${priority}`"
      :data-testid="`stat-${priority}`"
    >
      <span class="stat-label">{{ PRIORITY_LABELS[priority] }}</span>
      <span class="stat-value">{{ byPriority[priority] }}</span>
    </div>
  </section>
</template>
