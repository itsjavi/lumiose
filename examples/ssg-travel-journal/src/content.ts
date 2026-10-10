// The content layer: every post in content/posts/*.md, imported as a component at build time.
//
// `lumiose({ md })` compiles each file to a static component, validates its frontmatter
// (src/frontmatter.ts, run by the hook in vite.config.ts) and lists its headings. This module
// turns the modules into the `Post` API that pages, endpoints and tests use.
//
// Server-only in practice: pages and endpoints import it; islands get data through props or the
// prebuilt `/search.json` index.

import type { default as Markdown, Frontmatter, Heading } from "*.md";

export interface Post extends Frontmatter {
  /** From the file name: `content/posts/lisbon-on-foot.md` → `lisbon-on-foot`. */
  slug: string;
  /** The rendered body, a static component. */
  Content: typeof Markdown;
  /** The `##` headings, for the table of contents. */
  headings: readonly Heading[];
}

export interface TagCount {
  tag: string;
  count: number;
}

const modules = import.meta.glob<{
  default: typeof Markdown;
  frontmatter: Frontmatter;
  headings: readonly Heading[];
}>("../content/posts/*.md", { eager: true });

let cache: { posts: readonly Post[]; bySlug: Map<string, Post> } | undefined;

function load() {
  if (cache === undefined) {
    const posts = Object.entries(modules)
      .map(([file, module]): Post => ({
        ...module.frontmatter,
        slug: file.replace(/^.*\//, "").replace(/\.md$/, ""),
        Content: module.default,
        headings: module.headings.filter((heading) => heading.depth === 2),
      }))
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
