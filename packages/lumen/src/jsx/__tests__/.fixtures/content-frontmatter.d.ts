// A project's frontmatter type (see content.tsx), merged into lumen/env's `*.md` module.
declare module "*.md" {
  interface Frontmatter {
    title: string;
    date: Date;
  }
}
