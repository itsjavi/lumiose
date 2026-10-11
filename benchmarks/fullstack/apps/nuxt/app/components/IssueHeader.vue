<script setup lang="ts">
import type { Issue } from "@bench/data/format";

defineProps<{ issue: Issue }>();
</script>

<template>
  <header class="issue-header">
    <h1 class="page-title" data-testid="issue-title">
      {{ issue.title }} <span class="issue-number">#{{ issue.id }}</span>
    </h1>
    <div class="issue-meta" data-testid="issue-status">
      <StatusBadge :status="issue.status" />
      <PriorityBadge :priority="issue.priority" />
      <span class="muted"
        >in
        <NuxtLink :to="`/projects/${issue.project.slug}`">{{ issue.project.name }}</NuxtLink></span
      >
    </div>
  </header>
</template>
