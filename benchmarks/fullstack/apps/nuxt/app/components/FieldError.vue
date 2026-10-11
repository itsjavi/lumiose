<script setup lang="ts">
defineProps<{ name: string; error: string | undefined }>();
</script>

<template>
  <p v-if="error" :id="`${name}-error`" class="field-error" :data-testid="`error-${name}`">
    {{ error }}
  </p>
</template>
