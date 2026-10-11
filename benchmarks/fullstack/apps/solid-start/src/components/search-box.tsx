import type { SearchHit } from "@bench/data/format";
import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";

export const SEARCH_DEBOUNCE_MS = 150;

/**
 * The search input with debounced suggestions from `GET /api/search?q=`.
 * Rendered inside the page's GET form to /search.
 */
export function SearchBox(props: { defaultValue: string }) {
  // The initial value only: the input owns it afterwards.
  const [q, setQ] = createSignal(props.defaultValue);
  const [hits, setHits] = createSignal<SearchHit[]>([]);
  const [open, setOpen] = createSignal(false);

  createEffect(() => {
    const term = q().trim();
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
    onCleanup(() => {
      clearTimeout(timer);
      controller.abort();
    });
  });

  return (
    <div class="search-box">
      <input
        type="search"
        name="q"
        value={q()}
        onInput={(event) => {
          setQ(event.currentTarget.value);
          setOpen(true);
        }}
        placeholder="Search issues"
        autocomplete="off"
        aria-label="Search issues"
        data-testid="search-input"
      />
      <Show when={open() && hits().length > 0}>
        <ul class="suggestions" data-testid="suggestions">
          <For each={hits()}>
            {(hit) => (
              <li data-testid="suggestion">
                <a href={`/issues/${hit.id}`}>
                  <span class="issue-number">#{hit.id}</span> {hit.title}
                </a>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
