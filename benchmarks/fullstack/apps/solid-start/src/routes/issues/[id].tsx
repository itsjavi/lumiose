import { Title } from "@solidjs/meta";
import {
  createAsync,
  useSubmission,
  type RouteDefinition,
  type RouteSectionProps,
} from "@solidjs/router";
import { Show, Suspense, createEffect, createSignal, on } from "solid-js";
import {
  CommentFields,
  CommentList,
  CommentsFallback,
  IssueBody,
  IssueDetails,
  IssueHeader,
  StatusFields,
} from "../../components/issue.tsx";
import { NotFoundPage } from "../../components/not-found-page.tsx";
import { addComment, getComments, getIssue, updateStatus } from "../../lib/api.ts";

export const route = {
  preload: ({ params }) => {
    void getIssue(params.id!);
    void getComments(params.id!);
  },
} satisfies RouteDefinition;

export default function IssuePage(props: RouteSectionProps) {
  const issue = createAsync(() => getIssue(props.params.id!), { deferStream: true });
  // Not deferred: the comments stream in behind the Suspense fallback.
  const comments = createAsync(() => getComments(props.params.id!));
  const status = useSubmission(updateStatus);
  return (
    <Show when={issue()} fallback={<NotFoundPage />}>
      {(current) => (
        <>
          <Title>{`#${current().id} ${current().title} · Tracker`}</Title>
          <IssueHeader issue={current()} />
          <div class="issue-layout">
            <div class="issue-main">
              <IssueBody body={current().body} />
              <section class="comments" aria-label="Comments">
                <h2 class="panel-title">Comments</h2>
                <Suspense fallback={<CommentsFallback />}>
                  <Show when={comments()}>{(list) => <CommentList comments={list()} />}</Show>
                </Suspense>
                <CommentComposer issueId={current().id} />
              </section>
            </div>
            <aside class="issue-side">
              <IssueDetails issue={current()} />
              <form action={updateStatus.with(current().id)} method="post" class="status-form">
                <StatusFields status={current().status} pending={Boolean(status.pending)} />
              </form>
            </aside>
          </div>
        </>
      )}
    </Show>
  );
}

/** Textarea with a live character count; posts the action and clears itself on success. */
function CommentComposer(props: { issueId: number }) {
  const submission = useSubmission(addComment);
  const [body, setBody] = createSignal("");
  createEffect(
    on(
      () => submission.result,
      (result) => {
        if (result?.ok) setBody("");
      },
      { defer: true },
    ),
  );
  return (
    <form action={addComment.with(props.issueId)} method="post" class="comment-form">
      <CommentFields
        value={body()}
        onInput={setBody}
        pending={Boolean(submission.pending)}
        error={submission.result?.ok === false ? submission.result.error : undefined}
      />
    </form>
  );
}
