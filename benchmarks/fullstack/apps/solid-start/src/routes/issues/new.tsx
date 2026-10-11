import { Title } from "@solidjs/meta";
import { createAsync, useSubmission, type RouteDefinition } from "@solidjs/router";
import { EMPTY_ISSUE_FORM, IssueFormFields } from "../../components/forms.tsx";
import { PageTitle } from "../../components/layout.tsx";
import { createIssue, getLabels, getShell } from "../../lib/api.ts";

export const route = {
  preload: () => getLabels(),
} satisfies RouteDefinition;

export default function NewIssue() {
  // The layout's query (deduplicated): its project list fills the project select.
  const shell = createAsync(() => getShell(), { deferStream: true });
  const labels = createAsync(() => getLabels(), { deferStream: true });
  const submission = useSubmission(createIssue);
  return (
    <>
      <Title>New issue · Tracker</Title>
      <PageTitle>New issue</PageTitle>
      <form action={createIssue} method="post" class="form issue-form">
        <IssueFormFields
          projects={shell()?.projects ?? []}
          labels={labels() ?? []}
          values={submission.result?.values ?? EMPTY_ISSUE_FORM}
          errors={submission.result?.errors ?? {}}
          pending={Boolean(submission.pending)}
        />
      </form>
    </>
  );
}
