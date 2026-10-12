// Search: server-rendered results for ?q=, and the search box island with live suggestions.
import { Title, url } from "lumiose";
import { SearchResults } from "../../components/dashboard.tsx";
import { SearchBox } from "../../islands/search-box.tsx";
import { searchIssues } from "../../server/data.ts";

export default function SearchPage() {
  const q = url().searchParams.get("q")?.trim() ?? "";
  return (
    <>
      <Title>Search · Tracker</Title>
      <h1 class="page-title">Search</h1>
      <form method="get" action="/search" class="search-form" role="search">
        <SearchBox client:load value={q} />
      </form>
      {q === "" ? null : <SearchResults hits={searchIssues(q)} />}
    </>
  );
}
