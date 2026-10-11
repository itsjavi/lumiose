<script setup lang="ts">
import type { Label } from "@bench/data/format";

defineProps<{ labels: Label[]; testId?: string }>();
</script>

<template>
  <ul v-if="labels.length > 0" class="labels" :data-testid="testId">
    <li v-for="label in labels" :key="label.id" :class="`label label-${label.name}`">
      {{ label.name }}
    </li>
  </ul>
</template>
