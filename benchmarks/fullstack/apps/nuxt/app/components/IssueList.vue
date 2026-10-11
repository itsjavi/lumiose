<!-- A compact list of issues (the dashboard's "recently updated", testId `recent-issues`). -->
<script setup lang="ts">
import { formatDate, type IssueSummary } from "@bench/data/format";

defineProps<{ issues: IssueSummary[]; testId: string }>();
</script>

<template>
  <ul class="issue-list" :data-testid="testId">
    <li v-for="issue in issues" :key="issue.id" class="issue-item">
      <NuxtLink :to="`/issues/${issue.id}`" class="issue-link"
        ><span class="issue-number">#{{ issue.id }}</span> {{ issue.title }}</NuxtLink
      >
      <span class="issue-item-meta">
        <StatusBadge :status="issue.status" />
        <PriorityBadge :priority="issue.priority" />
        <span class="muted">{{ issue.project.name }}</span>
        <time :datetime="issue.updatedAt">{{ formatDate(issue.updatedAt) }}</time>
      </span>
    </li>
  </ul>
</template>
