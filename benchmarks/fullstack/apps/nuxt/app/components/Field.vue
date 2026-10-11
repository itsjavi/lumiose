<script setup lang="ts">
defineProps<{ name: string; label: string; error?: string }>();
</script>

<template>
  <div :class="error ? 'field has-error' : 'field'">
    <label class="field-label" :for="name">{{ label }}</label>
    <slot />
    <FieldError :name="name" :error="error" />
  </div>
</template>
