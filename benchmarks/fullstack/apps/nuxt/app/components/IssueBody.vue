<script setup lang="ts">
defineProps<{ body: string }>();
</script>

<template>
  <div class="issue-body" data-testid="issue-body">
    <p v-for="(paragraph, i) in body.split(/\n{2,}/)" :key="i">{{ paragraph }}</p>
  </div>
</template>
