import { Title } from "@solidjs/meta";
import { createAsync, useSearchParams, type RouteDefinition } from "@solidjs/router";
import { Show } from "solid-js";
import { SearchResults } from "../components/dashboard.tsx";
import { PageTitle } from "../components/layout.tsx";
import { SearchBox } from "../components/search-box.tsx";
import { getSearchResults } from "../lib/api.ts";

const termOf = (q: string | string[] | undefined) => String(q ?? "").trim();

export const route = {
  preload: ({ location }) => getSearchResults(termOf(location.query.q)),
} satisfies RouteDefinition;

export default function Search() {
  const [params] = useSearchParams<{ q?: string }>();
  const q = () => termOf(params.q);
  const hits = createAsync(() => getSearchResults(q()), { deferStream: true });
  return (
    <>
      <Title>Search · Tracker</Title>
      <PageTitle>Search</PageTitle>
      <form method="get" action="/search" class="search-form" role="search">
        <SearchBox defaultValue={q()} />
      </form>
      <Show when={q() ? hits() : undefined}>{(results) => <SearchResults hits={results()} />}</Show>
    </>
  );
}
