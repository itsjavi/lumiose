import { searchIssues } from "@bench/data";
import { PageTitle, SearchBox, SearchResults } from "@bench/react-ui";
import { Form } from "react-router";
import { AppLink } from "../lib/link";
import type { Route } from "./+types/search";

export const meta: Route.MetaFunction = () => [{ title: "Search · Tracker" }];

export function loader({ request }: Route.LoaderArgs) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  return { q, hits: searchIssues(q) };
}

export default function Search({ loaderData: { q, hits } }: Route.ComponentProps) {
  return (
    <>
      <PageTitle>Search</PageTitle>
      <Form method="get" action="/search" className="search-form" role="search">
        <SearchBox key={q} defaultValue={q} Link={AppLink} />
      </Form>
      {q && <SearchResults Link={AppLink} hits={hits} />}
    </>
  );
}
