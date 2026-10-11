import { PRIORITIES, PRIORITY_LABELS, type Label, type Project } from "@bench/data/format";
import { For, Show, type JSX } from "solid-js";
import type { IssueFormValues } from "../lib/api.ts";
import { LabelPicker } from "./label-picker.tsx";

export function FieldError(props: { name: string; error: string | undefined }) {
  return (
    <Show when={props.error}>
      <p class="field-error" id={`${props.name}-error`} data-testid={`error-${props.name}`}>
        {props.error}
      </p>
    </Show>
  );
}

function Field(props: { name: string; label: string; error?: string; children: JSX.Element }) {
  return (
    <div class={props.error ? "field has-error" : "field"}>
      <label class="field-label" for={props.name}>
        {props.label}
      </label>
      {props.children}
      <FieldError name={props.name} error={props.error} />
    </div>
  );
}

export const EMPTY_ISSUE_FORM: IssueFormValues = {
  title: "",
  body: "",
  project: "",
  priority: "medium",
  labels: [],
};

export interface IssueFormFieldsProps {
  projects: Project[];
  labels: Label[];
  values: IssueFormValues;
  errors: Partial<Record<keyof IssueFormValues, string>>;
  pending?: boolean;
}

/** The new-issue form's fields; the page renders the `<form>` (action) around them. */
export function IssueFormFields(props: IssueFormFieldsProps) {
  return (
    <>
      <Field name="title" label="Title" error={props.errors.title}>
        <input
          id="title"
          name="title"
          value={props.values.title}
          aria-invalid={props.errors.title ? "true" : undefined}
        />
      </Field>
      <Field name="body" label="Description" error={props.errors.body}>
        <textarea id="body" name="body" rows={8} value={props.values.body} />
      </Field>
      <div class="field-row">
        <Field name="project" label="Project" error={props.errors.project}>
          <select id="project" name="project">
            <option value="">Choose a project</option>
            <For each={props.projects}>
              {(project) => (
                <option value={project.slug} selected={props.values.project === project.slug}>
                  {project.name}
                </option>
              )}
            </For>
          </select>
        </Field>
        <Field name="priority" label="Priority" error={props.errors.priority}>
          <select id="priority" name="priority">
            <For each={PRIORITIES}>
              {(priority) => (
                <option value={priority} selected={props.values.priority === priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              )}
            </For>
          </select>
        </Field>
      </div>
      <div class={props.errors.labels ? "field has-error" : "field"}>
        <span class="field-label">Labels</span>
        <LabelPicker labels={props.labels} defaultValue={props.values.labels} />
        <FieldError name="labels" error={props.errors.labels} />
      </div>
      <button
        type="submit"
        class="btn btn-primary"
        data-testid="create-issue"
        disabled={props.pending}
      >
        Create issue
      </button>
    </>
  );
}

/** The login form's fields; the page renders the `<form>` (action) around them. */
export function LoginFields(props: { username: string; error: string | undefined }) {
  return (
    <>
      <Field name="username" label="Username" error={props.error}>
        <input id="username" name="username" value={props.username} autocomplete="username" />
      </Field>
      <button type="submit" class="btn btn-primary" data-testid="login-submit">
        Log in
      </button>
      <p class="muted">
        Try <code>alice</code> or <code>bob</code>.
      </p>
    </>
  );
}
