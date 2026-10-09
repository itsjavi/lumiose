import { PRIORITIES, PRIORITY_LABELS, type Label, type Project } from "@bench/data/format";
import type { ReactNode } from "react";
import { LabelPicker } from "./label-picker.tsx";

export function FieldError({ name, error }: { name: string; error: string | undefined }) {
  if (!error) return null;
  return (
    <p className="field-error" id={`${name}-error`} data-testid={`field-error-${name}`}>
      {error}
    </p>
  );
}

function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={error ? "field has-error" : "field"}>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      {children}
      <FieldError name={name} error={error} />
    </div>
  );
}

/** Raw values of the new-issue form, echoed back after a failed submission. */
export interface IssueFormValues {
  title: string;
  body: string;
  project: string;
  priority: string;
  labels: string[];
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

/** The new-issue form's fields; the app renders the `<form>` (action) around them. */
export function IssueFormFields({
  projects,
  labels,
  values,
  errors,
  pending = false,
}: IssueFormFieldsProps) {
  return (
    <>
      <Field name="title" label="Title" error={errors.title}>
        <input
          id="title"
          name="title"
          defaultValue={values.title}
          aria-invalid={errors.title ? true : undefined}
        />
      </Field>
      <Field name="body" label="Description" error={errors.body}>
        <textarea id="body" name="body" rows={8} defaultValue={values.body} />
      </Field>
      <div className="field-row">
        <Field name="project" label="Project" error={errors.project}>
          <select id="project" name="project" defaultValue={values.project}>
            <option value="">Choose a project</option>
            {projects.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field name="priority" label="Priority" error={errors.priority}>
          <select id="priority" name="priority" defaultValue={values.priority}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className={errors.labels ? "field has-error" : "field"}>
        <span className="field-label">Labels</span>
        <LabelPicker labels={labels} defaultValue={values.labels} />
        <FieldError name="labels" error={errors.labels} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        Create issue
      </button>
    </>
  );
}

/** The login form's fields; the app renders the `<form>` (action) around them. */
export function LoginFields({ username, error }: { username: string; error: string | undefined }) {
  return (
    <>
      <Field name="username" label="Username" error={error}>
        <input id="username" name="username" defaultValue={username} autoComplete="username" />
      </Field>
      <button type="submit" className="btn btn-primary">
        Log in
      </button>
      <p className="muted">
        Try <code>alice</code> or <code>bob</code>.
      </p>
    </>
  );
}
