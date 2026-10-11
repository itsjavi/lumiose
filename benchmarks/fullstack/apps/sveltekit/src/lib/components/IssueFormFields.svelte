<!-- The new-issue form's fields; the page renders the `<form>` (action) around them. -->
<script lang="ts">
  import { PRIORITIES, PRIORITY_LABELS, type Label, type Project } from "@bench/data/format";
  import type { IssueFormValues } from "../issue-form.ts";
  import Field from "./Field.svelte";
  import FieldError from "./FieldError.svelte";
  import LabelPicker from "./LabelPicker.svelte";

  let {
    projects,
    labels,
    values,
    errors,
    pending = false,
  }: {
    projects: Project[];
    labels: Label[];
    values: IssueFormValues;
    errors: Partial<Record<keyof IssueFormValues, string>>;
    pending?: boolean;
  } = $props();
</script>

<Field name="title" label="Title" error={errors.title}>
  <input id="title" name="title" value={values.title} aria-invalid={errors.title ? true : undefined} />
</Field>
<Field name="body" label="Description" error={errors.body}>
  <textarea id="body" name="body" rows="8" value={values.body}></textarea>
</Field>
<div class="field-row">
  <Field name="project" label="Project" error={errors.project}>
    <select id="project" name="project" value={values.project}>
      <option value="">Choose a project</option>
      {#each projects as project (project.slug)}
        <option value={project.slug}>{project.name}</option>
      {/each}
    </select>
  </Field>
  <Field name="priority" label="Priority" error={errors.priority}>
    <select id="priority" name="priority" value={values.priority}>
      {#each PRIORITIES as priority (priority)}
        <option value={priority}>{PRIORITY_LABELS[priority]}</option>
      {/each}
    </select>
  </Field>
</div>
<div class={errors.labels ? "field has-error" : "field"}>
  <span class="field-label">Labels</span>
  <LabelPicker {labels} defaultValue={values.labels} />
  <FieldError name="labels" error={errors.labels} />
</div>
<button type="submit" class="btn btn-primary" data-testid="create-issue" disabled={pending}>
  Create issue
</button>
