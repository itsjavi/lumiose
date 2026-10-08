// Client-side search over the prebuilt index (`/search.json`, written by routes/search.json.ts).
// Pure and tiny: the Search island imports it, so it ships to the browser.

export interface SearchEntry {
  url: string;
  title: string;
  summary: string;
  tags: string[];
  /** `YYYY-MM-DD`. */
  date: string;
}

/** Lowercase, without diacritics: `Café` → `cafe`. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * The entries matching every word of `query` in their title, tags or summary, best first:
 * title matches weigh most, then tags, then the summary; ties go to the newest post.
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  limit = 6,
): SearchEntry[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const title = normalize(entry.title);
    const tags = normalize(entry.tags.join(" "));
    const summary = normalize(entry.summary);
    let score = 0;
    for (const word of words) {
      const weight =
        (title.includes(word) ? 3 : 0) +
        (tags.includes(word) ? 2 : 0) +
        (summary.includes(word) ? 1 : 0);
      if (weight === 0) {
        score = 0;
        break;
      }
      score += weight;
    }
    if (score > 0) scored.push({ entry, score });
  }
  return scored
    .toSorted((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date))
    .slice(0, limit)
    .map(({ entry }) => entry);
}
