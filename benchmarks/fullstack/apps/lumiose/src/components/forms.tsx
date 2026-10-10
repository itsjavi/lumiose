// Form fields shared by the new-issue and login pages: the markup of @bench/react-ui's forms.tsx.
import { PRIORITIES, PRIORITY_LABELS, type Label, type Project } from "@bench/data/format";
import { LabelPicker } from "../islands/label-picker.tsx";

export function FieldError(props: { name: string; error: string | undefined }) {
  return props.error ? (
    <p class="field-error" id={`${props.name}-error`} data-testid={`error-${props.name}`}>
      {props.error}
    </p>
  ) : null;
}

function Field(props: { name: string; label: string; error?: string; children?: JSX.Element }) {
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

export function IssueFormFields(props: {
  projects: Project[];
  labels: Label[];
  values: IssueFormValues;
  errors: Partial<Record<keyof IssueFormValues, string>>;
}) {
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
        <textarea id="body" name="body" rows={8}>
          {props.values.body}
        </textarea>
      </Field>
      <div class="field-row">
        <Field name="project" label="Project" error={props.errors.project}>
          <select id="project" name="project">
            <option value="" selected={props.values.project === ""}>
              Choose a project
            </option>
            {props.projects.map((project) => (
              <option value={project.slug} selected={project.slug === props.values.project}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field name="priority" label="Priority" error={props.errors.priority}>
          <select id="priority" name="priority">
            {PRIORITIES.map((priority) => (
              <option value={priority} selected={priority === props.values.priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div class={props.errors.labels ? "field has-error" : "field"}>
        <span class="field-label">Labels</span>
        <LabelPicker client:load labels={props.labels} value={props.values.labels} />
        <FieldError name="labels" error={props.errors.labels} />
      </div>
      <button type="submit" class="btn btn-primary" data-testid="create-issue">
        Create issue
      </button>
    </>
  );
}

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
