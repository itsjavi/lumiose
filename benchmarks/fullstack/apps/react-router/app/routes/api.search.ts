import { searchIssues } from "@bench/data";
import type { Route } from "./+types/api.search";

export function loader({ request }: Route.LoaderArgs) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json(searchIssues(q, 8));
}
