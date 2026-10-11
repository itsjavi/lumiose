import { PAGE_SIZE, issueListHref, plural, type IssueSummary } from "@bench/data/format";
import { Title } from "@solidjs/meta";
import {
  createAsync,
  useLocation,
  useSubmission,
  type RouteDefinition,
  type RouteSectionProps,
} from "@solidjs/router";
import { Show, createEffect, createSignal } from "solid-js";
import { BulkBar, FilterFields, IssueTable, Pagination } from "../../components/issues.tsx";
import { PageTitle } from "../../components/layout.tsx";
import { NotFoundPage } from "../../components/not-found-page.tsx";
import { closeSelected, getProjectIssues } from "../../lib/api.ts";
import { searchRecord } from "../../lib/search.ts";

export const route = {
  preload: ({ params, location }) => getProjectIssues(params.slug!, searchRecord(location.search)),
} satisfies RouteDefinition;

export default function ProjectIssues(props: RouteSectionProps) {
  const location = useLocation();
  const data = createAsync(
    () => getProjectIssues(props.params.slug!, searchRecord(location.search)),
    { deferStream: true },
  );
  return (
    <Show when={data()} fallback={<NotFoundPage />}>
      {(loaded) => (
        <>
          <Title>{`${loaded().project.name} · Tracker`}</Title>
          <header class="page-header">
            <PageTitle>{loaded().project.name}</PageTitle>
            <p class="muted" data-testid="issue-total">
              {plural(loaded().total, "issue")}
            </p>
          </header>
          {/* A plain GET form: submitting it loads the filtered page. */}
          <form method="get" class="filters">
            <FilterFields filters={loaded().filters} labels={loaded().labels} />
          </form>
          <BulkSelect issues={loaded().items} />
          <Pagination
            page={loaded().filters.page}
            totalPages={Math.max(1, Math.ceil(loaded().total / PAGE_SIZE))}
            hrefFor={(page) => issueListHref(loaded().project.slug, loaded().filters, { page })}
          />
        </>
      )}
    </Show>
  );
}

/** Row checkboxes and "Close selected"; the page's queries revalidate after the action. */
function BulkSelect(props: { issues: IssueSummary[] }) {
  const submission = useSubmission(closeSelected);
  const [selected, setSelected] = createSignal<ReadonlySet<number>>(new Set());
  // The action has read the checked boxes when its submission starts: clear the selection then.
  createEffect(() => {
    if (submission.pending) setSelected(new Set<number>());
  });
  const toggleAll = () =>
    setSelected((current) =>
      props.issues.every((issue) => current.has(issue.id))
        ? new Set<number>()
        : new Set(props.issues.map((issue) => issue.id)),
    );
  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <form action={closeSelected} method="post" class="bulk-form">
      <IssueTable
        issues={props.issues}
        selected={selected()}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />
      <BulkBar count={selected().size} pending={Boolean(submission.pending)} />
    </form>
  );
}
