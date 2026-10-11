import type { Issue } from "@bench/data/format";
import { COMMENT_MAX } from "@bench/data/format";
import { Frame, type Handle } from "remix/component";

import { routes } from "../../routes.ts";
import {
  CommentsFallback,
  IssueBody,
  IssueDetails,
  IssueHeader,
  StatusFields,
} from "../../ui/issue.tsx";
import { CommentComposer } from "./public/comment-composer.tsx";

export function IssuePage(handle: Handle<{ issue: Issue; commentError?: string }>) {
  return () => {
    const { issue, commentError } = handle.props;
    const params = { id: String(issue.id) };
    return (
      <>
        <IssueHeader issue={issue} />
        <div class="issue-layout">
          <div class="issue-main">
            <IssueBody body={issue.body} />
            <section class="comments" aria-label="Comments">
              <h2 class="panel-title">Comments</h2>
              {/* The comments are their own route, streamed after the page behind the fallback. */}
              <Frame src={routes.issues.comments.href(params)} fallback={<CommentsFallback />} />
              <form method="post" action={routes.issues.comment.href(params)} class="comment-form">
                <CommentComposer max={COMMENT_MAX} error={commentError} />
              </form>
            </section>
          </div>
          <aside class="issue-side">
            <IssueDetails issue={issue} />
            <form method="post" action={routes.issues.status.href(params)} class="status-form">
              <StatusFields status={issue.status} />
            </form>
          </aside>
        </div>
      </>
    );
  };
}
