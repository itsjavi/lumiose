import { getIssue, listComments } from "@bench/data";
import {
  CommentList,
  CommentsFallback,
  IssueBody,
  IssueDetails,
  IssueHeader,
  StatusFields,
} from "@bench/react-ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import { updateStatus } from "../../actions";
import { AppLink } from "../../lib/link";
import { CommentComposer } from "./comment-composer";

/** Shared by generateMetadata and the page within one request. */
const loadIssue = cache((id: string) => (/^\d+$/.test(id) && getIssue(Number(id))) || notFound());

export async function generateMetadata({ params }: PageProps<"/issues/[id]">): Promise<Metadata> {
  const issue = loadIssue((await params).id);
  return { title: `#${issue.id} ${issue.title} · Tracker` };
}

export default async function IssuePage({ params }: PageProps<"/issues/[id]">) {
  const issue = loadIssue((await params).id);
  return (
    <>
      <IssueHeader Link={AppLink} issue={issue} />
      <div className="issue-layout">
        <div className="issue-main">
          <IssueBody body={issue.body} />
          <section className="comments" aria-label="Comments">
            <h2 className="panel-title">Comments</h2>
            <Suspense fallback={<CommentsFallback />}>
              <Comments issueId={issue.id} />
            </Suspense>
            <CommentComposer issueId={issue.id} />
          </section>
        </div>
        <aside className="issue-side">
          <IssueDetails issue={issue} />
          <form action={updateStatus.bind(null, issue.id)} className="status-form">
            <StatusFields status={issue.status} />
          </form>
        </aside>
      </div>
    </>
  );
}

/** Streams in behind the Suspense fallback. */
async function Comments({ issueId }: { issueId: number }) {
  return <CommentList comments={await listComments(issueId)} />;
}
