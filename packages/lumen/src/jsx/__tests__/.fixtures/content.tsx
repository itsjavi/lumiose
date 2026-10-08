// `lumen/env`: `.md` and `.html` imports (TASK-69). Static components without props; Markdown
// files also export their frontmatter, whose known fields a project declares by merging into
// `Frontmatter` (content-frontmatter.d.ts).
import "./helpers.ts";
import Post, { frontmatter, type Frontmatter } from "./content/post.md";
import Card from "./content/card.html";
import type { Frontmatter as AnyFrontmatter } from "*.md";

const data: Record<string, unknown> = frontmatter;
const title: string = frontmatter.title;
const year: number = frontmatter.date.getFullYear();
const typed: Frontmatter = { title: "A", date: new Date(), extra: 1 };
const same: AnyFrontmatter = typed;

export const accepted = [data, title, year, typed, same, <Post />, <Card />];

export const rejected = [
  // @ts-expect-error Content components take no props.
  <Post class="post" />,
  // @ts-expect-error Undeclared frontmatter values are unknown until validated.
  frontmatter.subtitle.toUpperCase(),
  // @ts-expect-error Declared fields keep their types.
  frontmatter.title.getFullYear(),
];
