import {
  LABELS_MAX,
  PRIORITIES,
  PRIORITY_LABELS,
  type IssueField,
  type Label,
  type Project,
} from "@bench/data/format";
import type { Handle } from "remix/component";

import { routes } from "../../../routes.ts";
import { Field, FieldError } from "../../../ui/fields.tsx";
import { LabelPicker } from "./public/label-picker.tsx";

/** Raw values of the new-issue form, rendered again after a failed submission. */
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

interface NewIssuePageProps {
  projects: Project[];
  labels: Label[];
  values: IssueFormValues;
  errors: Partial<Record<IssueField, string>>;
}

export function NewIssuePage(handle: Handle<NewIssuePageProps>) {
  return () => {
    const { projects, labels, values, errors } = handle.props;
    return (
      <>
        <h1 class="page-title">New issue</h1>
        <form method="post" action={routes.issues.new.action.href()} class="form issue-form">
          <Field name="title" label="Title" error={errors.title}>
            <input
              id="title"
              name="title"
              defaultValue={values.title}
              aria-invalid={errors.title ? true : undefined}
            />
          </Field>
          <Field name="body" label="Description" error={errors.body}>
            <textarea id="body" name="body" rows={8} defaultValue={values.body}></textarea>
          </Field>
          <div class="field-row">
            <Field name="project" label="Project" error={errors.project}>
              <select id="project" name="project">
                <option value="">Choose a project</option>
                {projects.map((project) => (
                  <option
                    key={project.slug}
                    value={project.slug}
                    selected={project.slug === values.project}
                  >
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="priority" label="Priority" error={errors.priority}>
              <select id="priority" name="priority">
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority} selected={priority === values.priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div class={errors.labels ? "field has-error" : "field"}>
            <span class="field-label">Labels</span>
            <LabelPicker
              names={labels.map((label) => label.name)}
              defaultValue={values.labels}
              max={LABELS_MAX}
            />
            <FieldError name="labels" error={errors.labels} />
          </div>
          <button type="submit" class="btn btn-primary" data-testid="create-issue">
            Create issue
          </button>
        </form>
      </>
    );
  };
}
