// The blog's content.

export interface Post {
  slug: string;
  title: string;
  date: string;
  body: string;
  tags: string[];
}

export const posts: Post[] = [
  {
    slug: "hello-lumiose",
    title: "Hello, Lumiose",
    date: "2026-10-01",
    body: "This site is static: every page is HTML built by `lumiose build`, with no JavaScript.",
    tags: ["lumiose", "intro"],
  },
  {
    slug: "adding-pages",
    title: "Adding pages",
    date: "2026-10-02",
    body: "Add a file under src/routes. Pages with params list their paths in staticPaths().",
    tags: ["lumiose", "routing"],
  },
  {
    slug: "styling",
    title: "Styling components",
    date: "2026-10-03",
    body: "Write plain CSS in <style> blocks; where a block sits decides its scope.",
    tags: ["css"],
  },
];

export function findPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}
