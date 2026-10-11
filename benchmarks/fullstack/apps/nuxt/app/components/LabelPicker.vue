<!-- Toggle chips that fill a hidden `labels` input with comma-separated label names. -->
<script setup lang="ts">
import { LABELS_MAX, type Label } from "@bench/data/format";

defineProps<{ labels: Label[] }>();

const selected = ref<string[]>([]);
const toggle = (name: string) => {
  selected.value = selected.value.includes(name)
    ? selected.value.filter((n) => n !== name)
    : [...selected.value, name];
};
</script>

<template>
  <div class="label-picker" data-testid="label-picker">
    <input type="hidden" name="labels" :value="selected.join(',')" />
    <button
      v-for="label in labels"
      :key="label.id"
      type="button"
      :class="`chip label-${label.name}`"
      :aria-pressed="selected.includes(label.name)"
      :disabled="!selected.includes(label.name) && selected.length >= LABELS_MAX"
      data-testid="label-chip"
      @click="toggle(label.name)"
    >
      {{ label.name }}
    </button>
  </div>
</template>
