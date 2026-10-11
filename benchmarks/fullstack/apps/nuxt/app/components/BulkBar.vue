<script setup lang="ts">
defineProps<{ count: number; pending: boolean }>();
</script>

<template>
  <div class="bulk-bar">
    <span data-testid="selected-count">{{ count }} selected</span>
    <button
      type="submit"
      class="btn btn-danger"
      data-testid="close-selected"
      :disabled="count === 0 || pending"
    >
      {{ pending ? "Closing…" : "Close selected" }}
    </button>
  </div>
</template>
