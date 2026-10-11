import {
  addComment,
  getIssue,
  isStatus,
  listComments,
  updateIssueStatus,
  validateComment,
} from "@bench/data";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { requireUser } from "../../middleware/session.ts";
import { routes } from "../../routes.ts";
import { CommentList } from "../../ui/issue.tsx";
import { notFound } from "../not-found.tsx";
import { renderPage } from "../page.tsx";
import { IssuePage } from "./show-page.tsx";

const issueId = (param: string): number | undefined =>
  /^\d+$/.test(param) ? Number(param) : undefined;

export default createController(routes.issues, {
  actions: {
    show(context) {
      const id = issueId(context.params.id);
      const issue = id === undefined ? undefined : getIssue(id);
      if (!issue) return notFound(context);
      return renderPage(context, `#${issue.id} ${issue.title}`, <IssuePage issue={issue} />);
    },

    async comments(context) {
      const id = issueId(context.params.id);
      if (id === undefined || !getIssue(id)) return notFound(context);
      return context.render(<CommentList comments={await listComments(id)} />);
    },

    comment: {
      middleware: [requireUser()],
      handler(context) {
        const id = issueId(context.params.id);
        if (id === undefined || !getIssue(id)) return notFound(context);
        const result = validateComment(context.formData.get("body"));
        if (!result.ok) {
          const issue = getIssue(id)!;
          return renderPage(
            context,
            `#${issue.id} ${issue.title}`,
            <IssuePage issue={issue} commentError={result.errors.body} />,
            { status: 400 },
          );
        }
        addComment(id, result.value, context.currentUser!.id);
        return redirect(routes.issues.show.href({ id: String(id) }), 303);
      },
    },

    status: {
      middleware: [requireUser()],
      handler(context) {
        const id = issueId(context.params.id);
        const status = context.formData.get("status");
        if (id === undefined || !isStatus(status))
          return new Response("Bad Request", { status: 400 });
        if (!updateIssueStatus(id, status, context.currentUser!.id)) return notFound(context);
        return redirect(routes.issues.show.href({ id: String(id) }), 303);
      },
    },
  },
});
