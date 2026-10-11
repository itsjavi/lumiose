<script setup lang="ts">
import { PRIORITY_LABELS, type Priority } from "@bench/data/format";

defineProps<{ priority: Priority }>();
</script>

<template>
  <span :class="`badge priority-${priority}`">{{ PRIORITY_LABELS[priority] }}</span>
</template>
