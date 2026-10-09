"use client";

import type { Label, Project } from "@bench/data/format";
import { EMPTY_ISSUE_FORM, IssueFormFields } from "@bench/react-ui";
import { useActionState } from "react";
import { createIssueAction } from "../../actions";

/** The new-issue form; failed validation re-renders it with the server's errors and the typed values. */
export function NewIssueForm({ projects, labels }: { projects: Project[]; labels: Label[] }) {
  const [state, formAction, pending] = useActionState(createIssueAction, { errors: {} });
  return (
    <form action={formAction} className="form issue-form">
      <IssueFormFields
        projects={projects}
        labels={labels}
        values={state.values ?? EMPTY_ISSUE_FORM}
        errors={state.errors}
        pending={pending}
      />
    </form>
  );
}
