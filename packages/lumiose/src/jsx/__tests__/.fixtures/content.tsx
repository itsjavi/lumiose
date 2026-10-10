// `lumiose/env`: `.md` and `.html` imports (TASK-69). Static components without props; Markdown
// files also export their frontmatter, whose known fields a project declares by merging into
// `Frontmatter` (content-frontmatter.d.ts).
import "./helpers.ts";
import Post, { frontmatter, headings, type Frontmatter, type Heading } from "./content/post.md";
import Card from "./content/card.html";
import type { Frontmatter as AnyFrontmatter } from "*.md";

const data: Record<string, unknown> = frontmatter;
const title: string = frontmatter.title;
const year: number = frontmatter.date.getFullYear();
const typed: Frontmatter = { title: "A", date: new Date(), extra: 1 };
const same: AnyFrontmatter = typed;

const toc = headings.map(({ depth, text, id }) => ({
  depth: depth as number,
  text,
  href: `#${id}`,
}));
const first: Heading | undefined = headings[0];

export const accepted = [data, title, year, typed, same, toc, first, <Post />, <Card />];

export const rejected = [
  // @ts-expect-error Content components take no props.
  <Post class="post" />,
  // @ts-expect-error Undeclared frontmatter values are unknown until validated.
  frontmatter.subtitle.toUpperCase(),
  // @ts-expect-error Declared fields keep their types.
  frontmatter.title.getFullYear(),
  // @ts-expect-error Headings are read-only.
  headings.push({ depth: 1, text: "x", id: "x" }),
  // @ts-expect-error Depths are 1 to 6.
  ((depth: Heading["depth"]) => depth)(7),
];
