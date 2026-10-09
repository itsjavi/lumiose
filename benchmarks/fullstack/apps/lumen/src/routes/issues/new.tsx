// The new-issue form: a plain form action. Validation errors re-render the form with the typed
// values (fail); success redirects to the new issue. The label picker is an island.
import { Title, actionData, fail, redirect, type ActionContext } from "lumen";
import {
  EMPTY_ISSUE_FORM,
  IssueFormFields,
  type IssueFormValues,
} from "../../components/forms.tsx";
import {
  createIssue,
  listLabels,
  listProjects,
  parseLabels,
  validateIssue,
} from "../../server/data.ts";
import { requireUser } from "../../server/session.ts";

interface Failure {
  values: IssueFormValues;
  errors: Partial<Record<keyof IssueFormValues, string>>;
}

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export const action = async (ctx: ActionContext<"/issues/new">) => {
  const user = requireUser(ctx);
  const form = await ctx.formData();
  const values: IssueFormValues = {
    title: text(form, "title"),
    body: text(form, "body"),
    project: text(form, "project"),
    priority: text(form, "priority"),
    labels: parseLabels(text(form, "labels")),
  };
  const parsed = validateIssue({ ...values, labels: text(form, "labels") });
  if (!parsed.ok) return fail(400, { values, errors: parsed.errors } satisfies Failure);
  redirect(`/issues/${createIssue(parsed.value, user.id)}`);
};

export default function NewIssuePage() {
  const failure = actionData<typeof action>();
  return (
    <>
      <Title>New issue · Tracker</Title>
      <h1 class="page-title">New issue</h1>
      <form method="post" class="form issue-form">
        <IssueFormFields
          projects={listProjects()}
          labels={listLabels()}
          values={failure?.values ?? EMPTY_ISSUE_FORM}
          errors={failure?.errors ?? {}}
        />
      </form>
    </>
  );
}
