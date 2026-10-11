<!-- The status form's controls; the page renders the `<form>` around them. -->
<script setup lang="ts">
import { STATUSES, STATUS_LABELS, type Status } from "@bench/data/format";

defineProps<{ status: Status; pending?: boolean }>();
</script>

<template>
  <label class="field">
    <span class="field-label">Status</span>
    <select name="status" data-testid="status-select">
      <option v-for="value in STATUSES" :key="value" :value="value" :selected="value === status">
        {{ STATUS_LABELS[value] }}
      </option>
    </select>
  </label>
  <button type="submit" class="btn" data-testid="status-submit" :disabled="pending">
    Update status
  </button>
</template>
