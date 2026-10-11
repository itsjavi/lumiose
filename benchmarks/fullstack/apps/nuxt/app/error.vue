<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();
const notFound = computed(() => props.error.statusCode === 404);

useHead({ title: () => (notFound.value ? "Not found" : "Error") });
</script>

<template>
  <NuxtLayout>
    <NotFound v-if="notFound" />
    <template v-else>
      <h1 class="page-title">Something went wrong</h1>
      <p class="muted">{{ error.statusCode }} {{ error.message }}</p>
    </template>
  </NuxtLayout>
</template>
