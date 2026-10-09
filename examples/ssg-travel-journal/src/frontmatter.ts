// Frontmatter validation, run at build time for every `.md` import by the `lumen({ md })` hook in
// vite.config.ts: a missing or invalid field fails the build with the file's name. It also adds
// the reading time, from the file's body.

import type { Frontmatter } from "*.md";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const WORDS_PER_MINUTE = 200;

/** The post fields of a file's frontmatter `data`; `source` is the whole file. */
export function postFrontmatter(
  data: Record<string, unknown>,
  file: string,
  source: string,
): Frontmatter {
  const name = file.replace(/^.*\//, "").replace(/\.md$/, "");
  if (!SLUG.test(name)) invalid("the file name must be a lowercase slug, such as my-trip.md.");

  const text = (field: string): string => {
    const value = data[field];
    if (typeof value !== "string" || value.trim() === "") {
      return invalid(`"${field}" must be a non-empty string.`);
    }
    return value.trim();
  };
  const date = text("date");
  if (!DAY.test(date) || Number.isNaN(Date.parse(date))) {
    invalid(`"date" must be a day such as 2026-09-18, got "${date}".`);
  }
  const tags: unknown = data.tags;
  if (!Array.isArray(tags) || tags.length === 0) {
    invalid(`"tags" must be a non-empty list, such as [cities, food].`);
  }
  for (const tag of tags) {
    if (typeof tag !== "string" || !SLUG.test(tag)) {
      invalid(`tag ${JSON.stringify(tag)} must be a lowercase slug, such as slow-travel.`);
    }
  }
  const cover = text("cover");
  if (!cover.startsWith("/")) invalid(`"cover" must be a site path, such as /covers/x.svg.`);

  const body = source.replace(FRONTMATTER, "");
  return {
    title: text("title"),
    date,
    tags: [...new Set(tags as string[])],
    summary: text("summary"),
    cover,
    readingMinutes: Math.max(1, Math.round(countWords(body) / WORDS_PER_MINUTE)),
  };
}

function invalid(message: string): never {
  throw new Error(message);
}

function countWords(markdown: string): number {
  return markdown.split(/\s+/).filter((word) => /\w/.test(word)).length;
}
