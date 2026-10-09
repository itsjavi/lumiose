import { createIssue, listLabels, parseLabels, validateIssue } from "@bench/data";
import {
  EMPTY_ISSUE_FORM,
  IssueFormFields,
  PageTitle,
  type IssueFormValues,
} from "@bench/react-ui";
import { Form, data, redirect, useNavigation, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "../root";
import { requireUser } from "../lib/session.server";
import type { Route } from "./+types/new-issue";

export const meta: Route.MetaFunction = () => [{ title: "New issue · Tracker" }];

export function loader() {
  return { labels: listLabels() };
}

export async function action({ request }: Route.ActionArgs) {
  const user = requireUser(request);
  const form = await request.formData();
  const input = Object.fromEntries(form);
  const result = validateIssue(input);
  if (!result.ok) {
    const values: IssueFormValues = {
      title: String(input.title ?? ""),
      body: String(input.body ?? ""),
      project: String(input.project ?? ""),
      priority: String(input.priority ?? ""),
      labels: parseLabels(input.labels),
    };
    return data({ errors: result.errors, values }, { status: 400 });
  }
  return redirect(`/issues/${createIssue(result.value, user.id)}`);
}

export default function NewIssue({ loaderData, actionData }: Route.ComponentProps) {
  const projects = useRouteLoaderData<typeof rootLoader>("root")?.projects ?? [];
  const navigation = useNavigation();
  return (
    <>
      <PageTitle>New issue</PageTitle>
      <Form method="post" className="form issue-form">
        <IssueFormFields
          projects={projects}
          labels={loaderData.labels}
          values={actionData?.values ?? EMPTY_ISSUE_FORM}
          errors={actionData?.errors ?? {}}
          pending={navigation.state === "submitting"}
        />
      </Form>
    </>
  );
}
