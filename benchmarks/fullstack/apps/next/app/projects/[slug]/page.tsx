import {
  PAGE_SIZE,
  getProject,
  issueListHref,
  listIssues,
  listLabels,
  parseIssueFilters,
  plural,
} from "@bench/data";
import { FilterFields, PageTitle, Pagination } from "@bench/react-ui";
import type { Metadata } from "next";
import Form from "next/form";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppLink } from "../../lib/link";
import { BulkSelect } from "./bulk-select";

/** Shared by generateMetadata and the page within one request. */
const loadProject = cache((slug: string) => getProject(slug) ?? notFound());

export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  return { title: `${loadProject((await params).slug).name} · Tracker` };
}

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[slug]">) {
  const project = loadProject((await params).slug);
  const filters = parseIssueFilters(await searchParams);
  const { items, total } = listIssues({ projectSlug: project.slug, ...filters });
  return (
    <>
      <header className="page-header">
        <PageTitle>{project.name}</PageTitle>
        <p className="muted" data-testid="issue-total">
          {plural(total, "issue")}
        </p>
      </header>
      <Form
        action={`/projects/${project.slug}`}
        className="filters"
        key={issueListHref(project.slug, filters)}
      >
        <FilterFields filters={filters} labels={listLabels()} />
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
