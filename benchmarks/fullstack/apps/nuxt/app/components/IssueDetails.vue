<script setup lang="ts">
import { formatDate, type Issue } from "@bench/data/format";

defineProps<{ issue: Issue }>();
</script>

<template>
  <dl class="details">
    <dt>Assignee</dt>
    <dd data-testid="assignee">{{ issue.assignee?.displayName ?? "Unassigned" }}</dd>
    <dt>Reporter</dt>
    <dd data-testid="reporter">{{ issue.reporter.displayName }}</dd>
    <dt>Created</dt>
    <dd>
      <time :datetime="issue.createdAt">{{ formatDate(issue.createdAt) }}</time>
    </dd>
    <dt>Updated</dt>
    <dd>
      <time :datetime="issue.updatedAt">{{ formatDate(issue.updatedAt) }}</time>
    </dd>
    <dt>Labels</dt>
    <dd>
      <LabelList v-if="issue.labels.length" :labels="issue.labels" test-id="issue-labels" />
      <span v-else class="muted">None</span>
    </dd>
  </dl>
</template>
