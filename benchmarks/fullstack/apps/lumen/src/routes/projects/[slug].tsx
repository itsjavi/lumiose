// A project's issues: GET filter form, 50 issues per page, pagination, and bulk "close selected"
// (the bulk-select island around the server-rendered table posts the `close` action).
import { PAGE_SIZE, issueListHref, parseIssueFilters, plural } from "@bench/data/format";
import {
  Title,
  notFound,
  params,
  redirect,
  url,
  type ActionContext,
  type RouteParams,
} from "lumen";
import { FilterFields, IssueTable, Pagination } from "../../components/issues.tsx";
import { BulkSelect } from "../../islands/bulk-select.tsx";
import { closeIssues, getProject, listIssues, listLabels } from "../../server/data.ts";
import { requireUser } from "../../server/session.ts";

export const actions = {
  async close(ctx: ActionContext<RouteParams<"/projects/[slug]">>) {
    const user = requireUser(ctx);
    const ids = (await ctx.formData())
      .getAll("ids")
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0);
    closeIssues(ids, user.id);
    // Back to the list the form was on, filters included (the action URL `?/close` has none).
    const from = URL.parse(ctx.request.headers.get("referer") ?? "");
    const back = from?.origin === ctx.url.origin ? from.pathname + from.search : ctx.url.pathname;
    redirect(back.startsWith(`/projects/${ctx.params.slug}`) ? back : ctx.url.pathname);
  },
};

export default function ProjectPage() {
  const project = getProject(params<"/projects/[slug]">().slug);
  if (project === undefined) notFound();
  const filters = parseIssueFilters(url().searchParams);
  const { items, total } = listIssues({
    ...filters,
    projectSlug: project.slug,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <>
      <Title>{project.name} · Tracker</Title>
      <header class="page-header">
        <h1 class="page-title">{project.name}</h1>
        <p class="muted" data-testid="issue-total">
          {plural(total, "issue")}
        </p>
      </header>
      <form method="get" class="filters">
        <FilterFields filters={filters} labels={listLabels()} />
      </form>
      <BulkSelect client:load>
        <IssueTable issues={items} />
      </BulkSelect>
      <Pagination
        page={filters.page}
        totalPages={totalPages}
        hrefFor={(page) => issueListHref(project.slug, filters, { page })}
      />
    </>
  );
}
