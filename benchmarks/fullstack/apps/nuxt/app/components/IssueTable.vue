<!-- The project page's issue table with row checkboxes (driven by the page's bulk select). -->
<script setup lang="ts">
import { formatDate, type IssueSummary } from "@bench/data/format";

const props = defineProps<{ issues: IssueSummary[]; selected: ReadonlySet<number> }>();
const emit = defineEmits<{ toggle: [id: number]; toggleAll: [] }>();

const allSelected = computed(
  () => props.issues.length > 0 && props.issues.every((issue) => props.selected.has(issue.id)),
);
</script>

<template>
  <table class="table issue-table" data-testid="issue-table">
    <thead>
      <tr>
        <th class="col-check">
          <input
            type="checkbox"
            aria-label="Select all"
            data-testid="select-all"
            :checked="allSelected"
            @change="emit('toggleAll')"
          />
        </th>
        <th class="num">#</th>
        <th>Title</th>
        <th>Status</th>
        <th>Priority</th>
        <th>Assignee</th>
        <th class="num">Comments</th>
        <th>Updated</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="issue in issues" :key="issue.id" data-testid="issue-row" :data-issue-id="issue.id">
        <td class="col-check">
          <input
            type="checkbox"
            name="ids"
            :value="issue.id"
            :aria-label="`Select issue #${issue.id}`"
            data-testid="row-select"
            :checked="selected.has(issue.id)"
            @change="emit('toggle', issue.id)"
          />
        </td>
        <td class="num muted">{{ issue.id }}</td>
        <td class="col-title">
          <NuxtLink :to="`/issues/${issue.id}`" class="issue-link">{{ issue.title }}</NuxtLink>
          <LabelList :labels="issue.labels" />
        </td>
        <td><StatusBadge :status="issue.status" /></td>
        <td><PriorityBadge :priority="issue.priority" /></td>
        <td>
          <template v-if="issue.assignee">{{ issue.assignee.displayName }}</template>
          <span v-else class="muted">Unassigned</span>
        </td>
        <td class="num">{{ issue.commentCount }}</td>
        <td>
          <time :datetime="issue.updatedAt">{{ formatDate(issue.updatedAt) }}</time>
        </td>
      </tr>
    </tbody>
  </table>
</template>
