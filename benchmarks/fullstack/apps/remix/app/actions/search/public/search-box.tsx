import { clientEntry, on, type Handle } from "remix/component";

import { routes } from "../../../routes.ts";

interface Hit {
  id: number;
  title: string;
}

const SEARCH_DEBOUNCE_MS = 150;

/**
 * The search input with debounced suggestions from `GET /api/search?q=`. Rendered inside the
 * page's GET form to /search, which the runtime submits as a client navigation.
 */
export const SearchBox = clientEntry(
  import.meta.url,
  function SearchBox(handle: Handle<{ defaultValue: string }>) {
    let hits: Hit[] = [];
    let open = false;

    return () => (
      <div class="search-box">
        <input
          type="search"
          name="q"
          defaultValue={handle.props.defaultValue}
          placeholder="Search issues"
          autoComplete="off"
          aria-label="Search issues"
          data-testid="search-input"
          mix={on("input", async (event, signal) => {
            open = true;
            const term = event.currentTarget.value.trim();
            if (!term) {
              hits = [];
              handle.update();
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS));
            if (signal.aborted) return;
            try {
              const url = `${routes.api.search.href()}?q=${encodeURIComponent(term)}`;
              const response = await fetch(url, { signal });
              if (!response.ok) return;
              const next = (await response.json()) as Hit[];
              if (signal.aborted) return;
              hits = next;
              handle.update();
            } catch {
              // Aborted by a newer keystroke, or offline: keep the previous suggestions.
            }
          })}
        />
        {open && hits.length > 0 ? (
          <ul class="suggestions" data-testid="suggestions">
            {hits.map((hit) => (
              <li key={hit.id} data-testid="suggestion">
                <a href={routes.issues.show.href({ id: String(hit.id) })}>
                  <span class="issue-number">#{hit.id}</span> {hit.title}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);
