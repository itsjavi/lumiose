import {
  addComment,
  getIssue,
  isStatus,
  listComments,
  updateIssueStatus,
  validateComment,
} from "@bench/data";
import { error, fail } from "@sveltejs/kit";
import { requireUser } from "#lib/server/session.ts";
import type { Actions, PageServerLoad } from "./$types";

function issueId(param: string): number {
  if (!/^\d+$/.test(param)) error(404, "Not Found");
  return Number(param);
}

export const load: PageServerLoad = ({ params }) => {
  const issue = getIssue(issueId(params.id));
  if (!issue) error(404, "Not Found");
  // Not awaited: SvelteKit streams the promise after the page, and the page renders it then.
  return { issue, comments: listComments(issue.id) };
};

export const actions: Actions = {
  status: async ({ request, params, locals }) => {
    const user = requireUser(locals);
    const status = (await request.formData()).get("status");
    if (!isStatus(status)) return fail(400, { status: { error: "Unknown status." } });
    if (!updateIssueStatus(issueId(params.id), status, user.id)) error(404, "Not Found");
  },
  comment: async ({ request, params, locals }) => {
    const user = requireUser(locals);
    const result = validateComment((await request.formData()).get("body"));
    if (!result.ok) return fail(400, { comment: { error: result.errors.body } });
    addComment(issueId(params.id), result.value, user.id);
    return { comment: { error: undefined } };
  },
};
