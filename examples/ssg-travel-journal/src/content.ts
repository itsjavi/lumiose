// The content layer: every post in content/posts/*.md, parsed once at build time.
//
// This is the only module that knows posts are Markdown files. It loads them as raw strings with
// `import.meta.glob(…, { query: "?raw" })`, splits off the YAML frontmatter (`yaml`), and renders
// the body with `marked`. Pages, endpoints and tests use the `Post` API below, so moving to native
// `.md` imports later (TASK-69) only changes this file.
//
// Server-only in practice: pages and endpoints import it; islands get data through props or the
// prebuilt `/search.json` index, so neither `marked` nor `yaml` reaches the browser.

import { Marked, type Tokens } from "marked";
import { parse as parseYaml } from "yaml";

export interface Heading {
  id: string;
  text: string;
}

export interface Post {
  /** From the file name: `content/posts/lisbon-on-foot.md` → `lisbon-on-foot`. */
  slug: string;
  title: string;
  /** Calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Lowercase slugs, such as `slow-travel`. */
  tags: readonly string[];
  summary: string;
  /** Site-relative image URL, such as `/covers/lisbon-on-foot.svg`. */
  cover: string;
  /** Rendered body (trusted: it comes from the repository). */
  html: string;
  /** The `##` headings, for the table of contents. */
  headings: readonly Heading[];
  readingMinutes: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

const sources = import.meta.glob<string>("../content/posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const WORDS_PER_MINUTE = 200;

/** `##`/`###` heading token → its anchor id, assigned per document before rendering. */
const headingIds = new WeakMap<Tokens.Heading, string>();

const markdown = new Marked({
  gfm: true,
  renderer: {
    heading(token) {
      const id = headingIds.get(token);
      const inner = this.parser.parseInline(token.tokens);
      if (id === undefined) return `<h${token.depth}>${inner}</h${token.depth}>\n`;
      return `<h${token.depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${token.depth}>\n`;
    },
  },
});

let cache: { posts: readonly Post[]; bySlug: Map<string, Post> } | undefined;

function load() {
  if (cache === undefined) {
    const posts = Object.entries(sources)
      .map(([file, source]) => parsePost(file, source))
      .toSorted((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
    cache = { posts, bySlug: new Map(posts.map((post) => [post.slug, post])) };
  }
  return cache;
}

/** Every post, newest first. */
export function allPosts(): readonly Post[] {
  return load().posts;
}

export function findPost(slug: string): Post | undefined {
  return load().bySlug.get(slug);
}

/** The posts before and after `slug` in date order. */
export function adjacentPosts(slug: string): { newer?: Post; older?: Post } {
  const posts = allPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return {};
  return { newer: posts[index - 1], older: posts[index + 1] };
}

/** Every tag with its number of posts: most used first, then by name. */
export function allTags(): readonly TagCount[] {
  const counts = new Map<string, number>();
  for (const post of allPosts()) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .toSorted((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The posts with `tag`, newest first. */
export function postsTagged(tag: string): readonly Post[] {
  return allPosts().filter((post) => post.tags.includes(tag));
}

/** Parses one Markdown file with frontmatter. Exported for tests. */
export function parsePost(file: string, source: string): Post {
  const slug = file.replace(/^.*\//, "").replace(/\.md$/, "");
  if (!SLUG.test(slug))
    invalid(file, `the file name must be a lowercase slug, such as my-trip.md.`);

  const match = FRONTMATTER.exec(source);
  if (match === null)
    invalid(file, "expected frontmatter between --- lines at the top of the file.");
  let data: unknown;
  try {
    data = parseYaml(match[1]!);
  } catch (error) {
    invalid(file, `the frontmatter is not valid YAML: ${(error as Error).message}`);
  }
  if (typeof data !== "object" || data === null)
    invalid(file, "the frontmatter must be a YAML mapping.");
  const fields = data as Record<string, unknown>;

  const text = (name: string): string => {
    const value = fields[name];
    if (typeof value !== "string" || value.trim() === "") {
      return invalid(file, `frontmatter "${name}" must be a non-empty string.`);
    }
    return value.trim();
  };
  const date = text("date");
  if (!DAY.test(date) || Number.isNaN(Date.parse(date))) {
    invalid(file, `frontmatter "date" must be a day such as 2026-09-18, got "${date}".`);
  }
  const tags: unknown = fields.tags;
  if (!Array.isArray(tags) || tags.length === 0) {
    invalid(file, `frontmatter "tags" must be a non-empty list, such as [cities, food].`);
  }
  for (const tag of tags) {
    if (typeof tag !== "string" || !SLUG.test(tag)) {
      invalid(file, `tag ${JSON.stringify(tag)} must be a lowercase slug, such as slow-travel.`);
    }
  }
  const cover = text("cover");
  if (!cover.startsWith("/"))
    invalid(file, `frontmatter "cover" must be a site path, such as /covers/x.svg.`);

  const body = match[2]!;
  const { html, headings } = render(body);
  return {
    slug,
    title: text("title"),
    date,
    tags: [...new Set(tags as string[])],
    summary: text("summary"),
    cover,
    html,
    headings,
    readingMinutes: Math.max(1, Math.round(countWords(body) / WORDS_PER_MINUTE)),
  };
}

function invalid(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

function render(body: string): { html: string; headings: Heading[] } {
  const tokens = markdown.lexer(body);
  const headings: Heading[] = [];
  const used = new Set<string>();
  markdown.walkTokens(tokens, (token) => {
    if (token.type !== "heading" || token.depth > 3) return;
    const heading = token as Tokens.Heading;
    const text = plainText(heading.text);
    let id = slugify(text) || "section";
    for (let n = 2; used.has(id); n++) id = `${slugify(text)}-${n}`;
    used.add(id);
    headingIds.set(heading, id);
    if (heading.depth === 2) headings.push({ id, text });
  });
  return { html: markdown.parser(tokens), headings };
}

function plainText(markdownText: string): string {
  return markdownText.replace(/[*_`~]/g, "").trim();
}

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function countWords(markdownText: string): number {
  return markdownText.split(/\s+/).filter((word) => /\w/.test(word)).length;
}
