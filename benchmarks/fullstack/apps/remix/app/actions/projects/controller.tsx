import { closeIssues, getProject, listIssues, listLabels, parseIssueFilters } from "@bench/data";
import { PAGE_SIZE, issueListHref, plural } from "@bench/data/format";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { requireUser } from "../../middleware/session.ts";
import { routes } from "../../routes.ts";
import { FilterFields, IssueTable, Pagination } from "../../ui/issues.tsx";
import { renderPage } from "../page.tsx";
import { notFound } from "../not-found.tsx";
import { BulkSelect } from "./public/bulk-select.tsx";

export default createController(routes.projects, {
  actions: {
    show(context) {
      const project = getProject(context.params.slug);
      if (!project) return notFound(context);
      const filters = parseIssueFilters(context.url.searchParams);
      const { items, total } = listIssues({ projectSlug: project.slug, ...filters });

      return renderPage(
        context,
        project.name,
        <>
          <header class="page-header">
            <h1 class="page-title">{project.name}</h1>
            <p class="muted" data-testid="issue-total">
              {plural(total, "issue")}
            </p>
          </header>
          <form method="get" class="filters">
            <FilterFields filters={filters} labels={listLabels()} />
          </form>
          {/* The action keeps the filters, so the redirect after closing comes back to them. */}
          <form
            method="post"
            action={`${routes.projects.close.href({ slug: project.slug })}${context.url.search}`}
            class="bulk-form"
          >
            <IssueTable issues={items} />
            <BulkSelect />
          </form>
          <Pagination
            page={filters.page}
            totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            hrefFor={(n: number) => issueListHref(project.slug, filters, { page: n })}
          />
        </>,
      );
    },

    close: {
      middleware: [requireUser()],
      handler(context) {
        const user = context.currentUser!;
        closeIssues(context.formData.getAll("ids").map(Number), user.id);
        return redirect(
          `${routes.projects.show.href({ slug: context.params.slug })}${context.url.search}`,
          303,
        );
      },
    },
  },
});
