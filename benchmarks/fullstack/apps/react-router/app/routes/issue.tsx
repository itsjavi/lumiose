import {
  addComment,
  getIssue,
  isStatus,
  listComments,
  updateIssueStatus,
  validateComment,
} from "@bench/data";
import {
  CommentFields,
  CommentList,
  CommentsFallback,
  IssueBody,
  IssueDetails,
  IssueHeader,
  StatusFields,
} from "@bench/react-ui";
import { Suspense, useEffect, useState } from "react";
import { Await, Form, data, useFetcher, useNavigation } from "react-router";
import { AppLink } from "../lib/link";
import { idParam, notFound } from "../lib/not-found.server";
import { requireUser } from "../lib/session.server";
import type { Route } from "./+types/issue";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `#${loaderData.issue.id} ${loaderData.issue.title} · Tracker` : "Tracker" },
];

export function loader({ params }: Route.LoaderArgs) {
  const issue = getIssue(idParam(params.id)) ?? notFound();
  // Not awaited: the comments stream in behind the Suspense fallback.
  return { issue, comments: listComments(issue.id) };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = requireUser(request);
  const id = idParam(params.id);
  const form = await request.formData();
  if (form.get("intent") === "comment") {
    const result = validateComment(form.get("body"));
    if (!result.ok) return data({ ok: false, error: result.errors.body }, { status: 400 });
    addComment(id, result.value, user.id);
    return { ok: true, error: undefined };
  }
  const status = form.get("status");
  if (!isStatus(status)) return data({ ok: false, error: "Unknown status." }, { status: 400 });
  if (!updateIssueStatus(id, status, user.id)) notFound();
  return { ok: true, error: undefined };
}

export default function IssuePage({ loaderData: { issue, comments } }: Route.ComponentProps) {
  const navigation = useNavigation();
  return (
    <>
      <IssueHeader Link={AppLink} issue={issue} />
      <div className="issue-layout">
        <div className="issue-main">
          <IssueBody body={issue.body} />
          <section className="comments" aria-label="Comments">
            <h2 className="panel-title">Comments</h2>
            <Suspense fallback={<CommentsFallback />}>
              <Await resolve={comments}>{(resolved) => <CommentList comments={resolved} />}</Await>
            </Suspense>
            <CommentComposer />
          </section>
        </div>
        <aside className="issue-side">
          <IssueDetails issue={issue} />
          <Form method="post" className="status-form">
            <StatusFields status={issue.status} pending={navigation.state === "submitting"} />
          </Form>
        </aside>
      </div>
    </>
  );
}

/** Textarea with a live character count; posts through a fetcher and clears itself on success. */
function CommentComposer() {
  const fetcher = useFetcher<typeof action>();
  const [body, setBody] = useState("");
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) setBody("");
  }, [fetcher.state, fetcher.data]);
  return (
    <fetcher.Form method="post" className="comment-form">
      <input type="hidden" name="intent" value="comment" />
      <CommentFields
        value={body}
        onChange={setBody}
        pending={fetcher.state !== "idle"}
        error={fetcher.data?.ok === false ? fetcher.data.error : undefined}
      />
    </fetcher.Form>
  );
}
