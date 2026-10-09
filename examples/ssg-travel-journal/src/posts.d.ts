// The fields every post's frontmatter has: `postFrontmatter` (src/frontmatter.ts) validates them
// at build time through `lumen({ md: { frontmatter } })` in vite.config.ts, and adds
// `readingMinutes`. Merged into `lumen/env`'s `Frontmatter`, the type of a `.md` module's
// `frontmatter` export. (Not named `content.d.ts`: TypeScript would take that file for the
// declarations of content.ts and ignore it.)
declare module "*.md" {
  interface Frontmatter {
    title: string;
    /** Calendar day, `YYYY-MM-DD` (YAML keeps it a string). */
    date: string;
    /** Lowercase slugs, such as `slow-travel`, without duplicates. */
    tags: readonly string[];
    summary: string;
    /** Site-relative image URL, such as `/covers/lisbon-on-foot.svg`. */
    cover: string;
    /** From the body's word count, at 200 words a minute. */
    readingMinutes: number;
  }
}
