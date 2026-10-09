"use client";

import type { SearchHit } from "@bench/data/format";
import { useEffect, useState } from "react";
import { Anchor, type LinkComponent } from "./link.tsx";

export const SEARCH_DEBOUNCE_MS = 150;

/**
 * The search input with debounced suggestions from `GET /api/search?q=`.
 * Rendered inside the app's GET form to /search.
 */
export function SearchBox({
  defaultValue,
  Link = Anchor,
}: {
  defaultValue: string;
  Link?: LinkComponent;
}) {
  const [q, setQ] = useState(defaultValue);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (response.ok) setHits(await response.json());
      } catch {
        // Aborted by a newer keystroke, or offline: keep the previous suggestions.
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  return (
    <div className="search-box">
      <input
        type="search"
        name="q"
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          setOpen(true);
        }}
        placeholder="Search issues"
        autoComplete="off"
        aria-label="Search issues"
        data-testid="search-input"
      />
      {open && hits.length > 0 && (
        <ul className="suggestions" data-testid="suggestions">
          {hits.map((hit) => (
            <li key={hit.id} data-testid="suggestion">
              <Link href={`/issues/${hit.id}`}>
                <span className="issue-number">#{hit.id}</span> {hit.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
