// An issue: header, body, details, the status form (a plain form action), the comments streamed
// behind <Suspense> (an async component), and the comment composer island.
import { isStatus } from "@bench/data/format";
import { Suspense, Title, fail, notFound, redirect, params, type ActionContext } from "lumiose";
import {
  CommentList,
  CommentsFallback,
  IssueBody,
  IssueDetails,
  IssueHeader,
  StatusFields,
} from "../../components/issue.tsx";
import { CommentComposer, type CommentFailure } from "../../islands/comment-composer.tsx";
import {
  addComment,
  getIssue,
  listComments,
  updateIssueStatus,
  validateComment,
} from "../../server/data.ts";
import { requireUser } from "../../server/session.ts";

type Context = ActionContext<"/issues/[id]">;

function issueId(raw: string): number {
  const id = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  return Number.isSafeInteger(id) ? id : notFound();
}

export const actions = {
  async status(ctx: Context) {
    const user = requireUser(ctx);
    const id = issueId(ctx.params.id);
    const status = (await ctx.formData()).get("status");
    if (!isStatus(status)) return fail(400, { error: "Choose a status." });
    if (!updateIssueStatus(id, status, user.id)) notFound();
    redirect(`/issues/${id}`);
  },

  async comment(ctx: Context) {
    const user = requireUser(ctx);
    const id = issueId(ctx.params.id);
    const parsed = validateComment((await ctx.formData()).get("body"));
    if (!parsed.ok) return fail(400, { error: parsed.errors.body ?? "" } satisfies CommentFailure);
    if (getIssue(id) === undefined) notFound();
    addComment(id, parsed.value, user.id);
    redirect(`/issues/${id}`);
  },
};

async function Comments(props: { issueId: number }) {
  const comments = await listComments(props.issueId);
  return <CommentList comments={comments} />;
}

export default function IssuePage() {
  const issue = getIssue(issueId(params<"/issues/[id]">().id));
  if (issue === undefined) notFound();
  return (
    <>
      <Title>{issue.title} · Tracker</Title>
      <IssueHeader issue={issue} />
      <div class="issue-layout">
        <div class="issue-main">
          <IssueBody body={issue.body} />
          <section class="comments" aria-label="Comments">
            <h2 class="panel-title">Comments</h2>
            <Suspense fallback={<CommentsFallback />}>
              <Comments issueId={issue.id} />
            </Suspense>
            <CommentComposer client:load />
          </section>
        </div>
        <aside class="issue-side">
          <IssueDetails issue={issue} />
          <form method="post" action="?/status" class="status-form">
            <StatusFields status={issue.status} />
          </form>
        </aside>
      </div>
    </>
  );
}
