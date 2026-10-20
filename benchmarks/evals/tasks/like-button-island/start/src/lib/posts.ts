// The blog's content. Replace it with Markdown files (`import.meta.glob("./posts/*.md", { query:
// "?raw" })`), a CMS or a database: pages read it at build time.

export interface Post {
  slug: string;
  title: string;
  date: string;
  body: string;
  likes: number;
}

export const posts: Post[] = [
  {
    slug: "hello-lumiose",
    title: "Hello, Lumiose",
    date: "2026-10-01",
    body: "This site is static: every page is HTML built by `lumiose build`, with no JavaScript.",
    likes: 12,
  },
  {
    slug: "adding-pages",
    title: "Adding pages",
    date: "2026-10-02",
    body: "Add a file under src/routes. Pages with params list their paths in staticPaths().",
    likes: 3,
  },
];

export function findPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}
