import { getProject, listIssues, listLabels, parseIssueFilters } from "@bench/data";

/** The project page: the project, its filtered page of issues and the filter form's labels. */
export default defineEventHandler((event) => {
  const project = getProject(getRouterParam(event, "slug") ?? "");
  if (!project) throw createError({ statusCode: 404, statusMessage: "Not Found" });
  const filters = parseIssueFilters(getRequestURL(event).searchParams);
  const { items, total } = listIssues({ projectSlug: project.slug, ...filters });
  return { project, filters, items, total, labels: listLabels() };
});
