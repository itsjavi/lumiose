import { searchIssues } from "@bench/data";
import { PageTitle, SearchResults } from "@bench/react-ui";
import type { Metadata } from "next";
import Form from "next/form";
import { AppLink } from "../lib/link";
import { SearchBox } from "./search-box";

export const metadata: Metadata = { title: "Search · Tracker" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  return (
    <>
      <PageTitle>Search</PageTitle>
      <Form action="/search" className="search-form" role="search">
        <SearchBox key={q} defaultValue={q} />
      </Form>
      {q && <SearchResults Link={AppLink} hits={searchIssues(q)} />}
    </>
  );
}
