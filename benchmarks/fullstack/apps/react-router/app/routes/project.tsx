import { closeIssues, getProject, listIssues, listLabels, parseIssueFilters } from "@bench/data";
// The component uses these too: import them from the DB-free entry so the client bundle stays clean.
import { PAGE_SIZE, issueListHref, plural, type IssueSummary } from "@bench/data/format";
import { BulkBar, FilterFields, IssueTable, PageTitle, Pagination } from "@bench/react-ui";
import { useState } from "react";
import { Form, useFetcher, useLocation } from "react-router";
import { AppLink } from "../lib/link";
import { notFound } from "../lib/not-found.server";
import { requireUser } from "../lib/session.server";
import type { Route } from "./+types/project";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `${loaderData?.project.name ?? "Project"} · Tracker` },
];

export function loader({ params, request }: Route.LoaderArgs) {
  const project = getProject(params.slug) ?? notFound();
  const filters = parseIssueFilters(new URL(request.url).searchParams);
  const { items, total } = listIssues({ projectSlug: project.slug, ...filters });
  return { project, filters, items, total, labels: listLabels() };
}

/** Bulk close: posted by the bulk-select fetcher. */
export async function action({ request }: Route.ActionArgs) {
  const user = requireUser(request);
  const ids = (await request.formData()).getAll("ids").map(Number);
  return { closed: closeIssues(ids, user.id) };
}

export default function ProjectIssues({ loaderData }: Route.ComponentProps) {
  const { project, filters, items, total, labels } = loaderData;
  const { search } = useLocation();
  return (
    <>
      <header className="page-header">
        <PageTitle>{project.name}</PageTitle>
        <p className="muted" data-testid="issue-total">
          {plural(total, "issue")}
        </p>
      </header>
      <Form method="get" className="filters" key={search}>
        <FilterFields filters={filters} labels={labels} />
      </Form>
      <BulkSelect issues={items} />
      <Pagination
        Link={AppLink}
        page={filters.page}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        hrefFor={(page) => issueListHref(project.slug, filters, { page })}
      />
    </>
  );
}

/** Row checkboxes and "Close selected"; the list revalidates after the fetcher's action. */
function BulkSelect({ issues }: { issues: IssueSummary[] }) {
  const fetcher = useFetcher<typeof action>();
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const toggleAll = () =>
    setSelected((current) =>
      issues.every((issue) => current.has(issue.id))
        ? new Set()
        : new Set(issues.map((issue) => issue.id)),
    );
  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    // The fetcher reads the checked boxes when the form submits, before the selection is cleared.
    <fetcher.Form method="post" className="bulk-form" onSubmit={() => setSelected(new Set())}>
      <IssueTable
        Link={AppLink}
        issues={issues}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />
      <BulkBar count={selected.size} pending={fetcher.state !== "idle"} />
    </fetcher.Form>
  );
}
