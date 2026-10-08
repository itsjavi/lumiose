// `.md` and `.html` imports (`lumen({ md, html })`, TASK-69; owner: Halo): ambient module types
// loaded by `lumen/env`. A script file (no top-level import), so that `declare module "*.md"`
// declares a module pattern instead of augmenting a module.

declare module "*.md" {
  /** The file's content as a static component (CommonMark + GFM, headings with ids). */
  const Content: () => import("lumen/jsx-runtime").JSX.Element;
  export default Content;
  /**
   * The type of `frontmatter`: any keys, `unknown` values. When the `lumen({ md: { frontmatter } })`
   * hook guarantees fields, declare them by merging into this interface from a project `.d.ts`:
   * `declare module "*.md" { interface Frontmatter { title: string } }`.
   */
  export interface Frontmatter extends Record<string, unknown> {}
  /** The file's YAML frontmatter (`{}` without one), as returned by the optional hook. */
  export const frontmatter: Frontmatter;
}

declare module "*.html" {
  /**
   * The file's content as a static component: a full document's `<body>`, or the fragment as it
   * is. Its `<script>` elements run as client modules wherever the component renders.
   */
  const Content: () => import("lumen/jsx-runtime").JSX.Element;
  export default Content;
}
