import type { SearchHit } from "@bench/data/format";
import type { Handle } from "remix/component";

import { routes } from "../routes.ts";
import { StatusBadge } from "./badges.tsx";

export function SearchResults(handle: Handle<{ hits: SearchHit[] }>) {
  return () => (
    <ul class="issue-list" data-testid="search-results">
      {handle.props.hits.map((hit) => (
        <li key={hit.id} class="issue-item" data-testid="search-result">
          <a href={routes.issues.show.href({ id: String(hit.id) })} class="issue-link">
            <span class="issue-number">#{hit.id}</span> {hit.title}
          </a>
          <span class="issue-item-meta">
            <StatusBadge status={hit.status} />
            <span class="muted">{hit.project.name}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
