// A project's frontmatter type (see content.tsx), merged into lumiose/env's `*.md` module.
declare module "*.md" {
  interface Frontmatter {
    title: string;
    date: Date;
  }
}
