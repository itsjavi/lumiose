// Docs search: the index entries (built by routes/search.json.ts) and the scoring the DocsSearch
// island runs in the browser. Every term of the query must match; title matches rank first, then
// headings, the summary and the body.

export interface SearchEntry {
  url: string;
  title: string;
  section: string;
  summary: string;
  /** `[id, text]` of the page's `##`/`###` headings. */
  headings: [string, string][];
  /** The page's plain text. */
  text: string;
}

export interface SearchResult {
  /** The page URL, with the matching heading's `#id` when a heading matched. */
  url: string;
  title: string;
  section: string;
  /** The matching heading, if any. */
  heading?: string;
  /** Text around the first match in the body, or the summary. */
  snippet: string;
}

const LIMIT = 8;

export function searchDocs(entries: readonly SearchEntry[], query: string): SearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored: { score: number; result: SearchResult }[] = [];
  for (const entry of entries) {
    const title = entry.title.toLowerCase();
    const summary = entry.summary.toLowerCase();
    const body = entry.text.toLowerCase();
    let score = 0;
    let heading: [string, string] | undefined;
    for (const term of terms) {
      const inHeading = entry.headings.find(([, text]) => text.toLowerCase().includes(term));
      const points =
        (title.includes(term) ? (title.startsWith(term) ? 12 : 8) : 0) +
        (inHeading ? 4 : 0) +
        (summary.includes(term) ? 2 : 0) +
        (body.includes(term) ? 1 : 0);
      if (points === 0) {
        score = 0;
        break;
      }
      score += points;
      heading ??= title.includes(term) ? undefined : inHeading;
    }
    if (score === 0) continue;
    scored.push({
      score,
      result: {
        url: heading ? `${entry.url}#${heading[0]}` : entry.url,
        title: entry.title,
        section: entry.section,
        ...(heading ? { heading: heading[1] } : {}),
        snippet: snippet(entry, terms),
      },
    });
  }
  return scored
    .toSorted((a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title))
    .slice(0, LIMIT)
    .map((item) => item.result);
}

/** About 120 characters of the body around the first matching term, else the summary. */
export function snippet(entry: SearchEntry, terms: readonly string[]): string {
  const body = entry.text.toLowerCase();
  for (const term of terms) {
    const at = body.indexOf(term);
    if (at === -1) continue;
    const start = Math.max(0, at - 40);
    const end = Math.min(entry.text.length, at + 80);
    return `${start > 0 ? "…" : ""}${entry.text.slice(start, end).trim()}${end < entry.text.length ? "…" : ""}`;
  }
  return entry.summary;
}
