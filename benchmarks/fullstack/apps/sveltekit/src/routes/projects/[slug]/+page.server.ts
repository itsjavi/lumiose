import { closeIssues, getProject, listIssues, listLabels, parseIssueFilters } from "@bench/data";
import { error } from "@sveltejs/kit";
import { requireUser } from "#lib/server/session.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const project = getProject(params.slug);
  if (!project) error(404, "Not Found");
  const filters = parseIssueFilters(url.searchParams);
  const { items, total } = listIssues({ projectSlug: project.slug, ...filters });
  return { project, filters, items, total, labels: listLabels() };
};

export const actions: Actions = {
  /** Bulk close: the bulk-select form posts the checked `ids`. */
  close: async ({ request, locals }) => {
    const user = requireUser(locals);
    const ids = (await request.formData()).getAll("ids").map(Number);
    return { closed: closeIssues(ids, user.id) };
  },
};
