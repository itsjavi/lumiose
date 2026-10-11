<!-- The new-issue form's fields; the page renders the `<form>` around them. -->
<script setup lang="ts">
import { PRIORITIES, PRIORITY_LABELS, type Label, type Project } from "@bench/data/format";

defineProps<{
  projects: Project[];
  labels: Label[];
  errors: Partial<Record<string, string>>;
  pending?: boolean;
}>();
</script>

<template>
  <Field name="title" label="Title" :error="errors.title">
    <input id="title" name="title" :aria-invalid="errors.title ? true : undefined" />
  </Field>
  <Field name="body" label="Description" :error="errors.body">
    <textarea id="body" name="body" rows="8"></textarea>
  </Field>
  <div class="field-row">
    <Field name="project" label="Project" :error="errors.project">
      <select id="project" name="project">
        <option value="">Choose a project</option>
        <option v-for="project in projects" :key="project.slug" :value="project.slug">
          {{ project.name }}
        </option>
      </select>
    </Field>
    <Field name="priority" label="Priority" :error="errors.priority">
      <select id="priority" name="priority">
        <option
          v-for="priority in PRIORITIES"
          :key="priority"
          :value="priority"
          :selected="priority === 'medium'"
        >
          {{ PRIORITY_LABELS[priority] }}
        </option>
      </select>
    </Field>
  </div>
  <div :class="errors.labels ? 'field has-error' : 'field'">
    <span class="field-label">Labels</span>
    <LabelPicker :labels="labels" />
    <FieldError name="labels" :error="errors.labels" />
  </div>
  <button type="submit" class="btn btn-primary" data-testid="create-issue" :disabled="pending">
    Create issue
  </button>
</template>
