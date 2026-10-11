<script setup lang="ts">
import { STATUS_LABELS, type Status } from "@bench/data/format";

defineProps<{ status: Status }>();
</script>

<template>
  <span :class="`badge status-${status}`">{{ STATUS_LABELS[status] }}</span>
</template>
