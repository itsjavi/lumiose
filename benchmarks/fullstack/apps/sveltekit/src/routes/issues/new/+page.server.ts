import { createIssue, listLabels, parseLabels, validateIssue } from "@bench/data";
import { fail, redirect } from "@sveltejs/kit";
import type { IssueFormValues } from "#lib/issue-form.ts";
import { requireUser } from "#lib/server/session.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({ labels: listLabels() });

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = requireUser(locals);
    const input = Object.fromEntries(await request.formData());
    const result = validateIssue(input);
    if (!result.ok) {
      const values: IssueFormValues = {
        title: String(input.title ?? ""),
        body: String(input.body ?? ""),
        project: String(input.project ?? ""),
        priority: String(input.priority ?? ""),
        labels: parseLabels(input.labels),
      };
      return fail(400, { errors: result.errors, values });
    }
    redirect(303, `/issues/${createIssue(result.value, user.id)}`);
  },
};
