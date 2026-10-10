// `.md` and `.html` imports (`lumiose({ md, html })`, TASK-69; owner: Halo): ambient module types
// loaded by `lumiose/env`. A script file (no top-level import), so that `declare module "*.md"`
// declares a module pattern instead of augmenting a module.

declare module "*.md" {
  /** The file's content as a static component (CommonMark + GFM, headings with ids). */
  const Content: () => import("lumiose/jsx-runtime").JSX.Element;
  export default Content;
  /**
   * The type of `frontmatter`: any keys, `unknown` values. When the `lumiose({ md: { frontmatter } })`
   * hook guarantees fields, declare them by merging into this interface from a project `.d.ts`:
   * `declare module "*.md" { interface Frontmatter { title: string } }`.
   */
  export interface Frontmatter extends Record<string, unknown> {}
  /** The file's YAML frontmatter (`{}` without one), as returned by the optional hook. */
  export const frontmatter: Frontmatter;
  /** A heading of the file: its level, its text, and the id of its rendered anchor. */
  export interface Heading {
    readonly depth: 1 | 2 | 3 | 4 | 5 | 6;
    /** The heading's text content, whitespace collapsed. */
    readonly text: string;
    /** The rendered element's `id` (`#${id}` links to it). */
    readonly id: string;
  }
  /**
   * The file's headings in document order, raw HTML ones included, with the ids of their rendered
   * anchors. Headings whose text has no slug (`## !!!`) have no id and are left out.
   */
  export const headings: ReadonlyArray<Heading>;
}

declare module "*.html" {
  /**
   * The file's content as a static component: a full document's `<body>`, or the fragment as it
   * is. Its `<script>` elements run as client modules wherever the component renders.
   */
  const Content: () => import("lumiose/jsx-runtime").JSX.Element;
  export default Content;
}
