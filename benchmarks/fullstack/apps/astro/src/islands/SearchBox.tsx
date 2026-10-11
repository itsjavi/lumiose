import type { SearchHit } from "@bench/data/format";
import { useEffect, useState } from "preact/hooks";

const SEARCH_DEBOUNCE_MS = 150;

/**
 * The search input with debounced suggestions from `GET /api/search?q=` (a Preact island).
 * Rendered inside the search page's GET form to /search.
 */
export default function SearchBox({ defaultValue }: { defaultValue: string }) {
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
    <div class="search-box">
      <input
        type="search"
        name="q"
        value={q}
        onInput={(event) => {
          setQ(event.currentTarget.value);
          setOpen(true);
        }}
        placeholder="Search issues"
        autoComplete="off"
        aria-label="Search issues"
        data-testid="search-input"
      />
      {open && hits.length > 0 && (
        <ul class="suggestions" data-testid="suggestions">
          {hits.map((hit) => (
            <li key={hit.id} data-testid="suggestion">
              <a href={`/issues/${hit.id}`}>
                <span class="issue-number">#{hit.id}</span> {hit.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
