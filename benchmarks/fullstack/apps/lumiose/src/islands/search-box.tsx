// Island: the search input with debounced suggestions from GET /api/search?q= (earlier requests
// aborted). The page renders it inside its GET form to /search, so Enter shows the full results.
import type { SearchHit } from "@bench/data/format";
import { fetchJSON, onCleanup, onMount, signal } from "lumiose";
import { markReady } from "../lib/ready.ts";

const DEBOUNCE_MS = 150;

export function SearchBox(props: { value: string }) {
  const hits = signal<SearchHit[]>([]);
  const open = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | undefined;

  onMount(markReady);
  onCleanup(() => {
    clearTimeout(timer);
    pending?.abort();
  });

  function search(q: string) {
    open.set(true);
    clearTimeout(timer);
    pending?.abort();
    const term = q.trim();
    if (term === "") {
      hits.set([]);
      return;
    }
    timer = setTimeout(async () => {
      const controller = (pending = new AbortController());
      try {
        hits.set(
          await fetchJSON<SearchHit[]>(`/api/search?q=${encodeURIComponent(term)}`, {
            signal: controller.signal,
          }),
        );
      } catch {
        // Aborted by a newer keystroke, or offline: keep the previous suggestions.
      }
    }, DEBOUNCE_MS);
  }

  return (
    <div class="search-box">
      <input
        type="search"
        name="q"
        value={props.value}
        onInput={(event) => search(event.currentTarget.value)}
        placeholder="Search issues"
        autocomplete="off"
        aria-label="Search issues"
        data-testid="search-input"
      />
      {open() && hits().length > 0 && (
        <ul class="suggestions" data-testid="suggestions">
          {hits().map((hit) => (
            <li data-testid="suggestion">
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
