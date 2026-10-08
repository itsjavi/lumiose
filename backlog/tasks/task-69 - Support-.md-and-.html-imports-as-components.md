---
id: TASK-69
title: Support .md and .html imports as components
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 22:10'
labels: []
milestone: m-3
dependencies: []
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user approved optional support for importing Markdown and HTML files as Lumen components (decision-22), e.g. web components defined in single .html files and blogs written in .md. These are build-time transforms, so they work identically in SPA, SSR and SSG. File-based routing for .md/.html pages is a separate, not-yet-approved idea.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opt-in via lumen({ md: true | options, html: true }); import Post, { frontmatter } from "./post.md" gives a static component (plain CommonMark + GFM, no MDX, compiled in Rust, e.g. comrak or pulldown-cmark), with heading ids; frontmatter (YAML) exported
- [ ] #2 import Card from "./card.html" gives a component; a full document contributes only its <body> inner content; fragments are used as-is; <script> elements run as client modules (bundled by Vite and loaded on the client wherever the component renders, like island modules), which web components need
- [ ] #3 Top-level <style> in .html/.md files is scoped to that file content (like .stsx top-level blocks; <style global> opts out); <style> inside <template> or <svg> is left verbatim; no $refs
- [ ] #4 Type declarations for *.md and *.html (lumen/env); works in client and server builds and in dev with HMR; tests; docs concept page
- [ ] #5 Frontmatter: exported as plain data typed Record<string, unknown>; optional build-time hook lumen({ md: { frontmatter(data, { file }) } }) for user validation/transformation (errors fail the build with file context); no built-in schema conventions; docs show validating with any library and augmenting declare module "*.md"
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. crates/lumen_content (Halo, new): Markdown with comrak 0.55 (CommonMark + GFM tables, strikethrough, task lists, autolinks, footnotes; raw HTML kept; +~680 KB vs pulldown-cmark +~550 KB without GFM autolinks) -> HTML; HTML (and the Markdown output) parsed with html5ever (spec tree building: implied tags, template contents, SVG names) -> the .stsx source of a static component: text as JS strings, attributes as strings, full documents -> <body> children (+ head <style>/<script>), top-level <style> -> file-level blocks (<style global> kept), nested <style> in place (subtree scope, as .stsx), <template>/<noscript> content and data-block <script>s verbatim via innerHTML, svg <style> verbatim, JS <script>s removed and listed; Markdown heading ids (GitHub slugs, deduplicated); frontmatter split off and returned raw. 2. napi contentSource(source, filename, kind) -> { code, frontmatter, scripts }. 3. src/vite/content.ts: resolveId maps ./x.md and ./x.html imports (not HTML entries) to the virtual Lumen module <file>.stsx, compiled by the main transform (styles, CSS manifest, islands, HMR via addWatchFile); <file>?lumen-frontmatter (YAML via the yaml package, lumen({ md: { frontmatter } }) hook, serialized as JS data); scripts: the component renders <Script client:load /> from <file>?lumen-script (client: imports the scripts; server: an empty island), so pages load them like island modules; index.ts/scan.ts get small hooks (content source for style loads and the build scan). 4. lumen/env types for *.md and *.html. 5. Tests (Rust goldens compiled for both targets, robustness; Vite dev server: client/ssr, frontmatter hook + errors, scripts island, styles, HMR graph), docs concept page + reference.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: user answers recorded in the decision-22 amendment. Plain Markdown; html <script> runs as a client module; file-scoped <style> with <template>/<svg> left verbatim; layouts by folder only; user-defined frontmatter schemas (mechanism pending confirmation).

Lux: reassigned to Halo (owner of asset-import transforms, after TASK-70 SVG imports). Markdown in Rust (pulldown-cmark or comrak) exposed via napi; the Vite plugin integration is in src/vite (Photon's area), so coordinate via notes or a small new module.
<!-- SECTION:NOTES:END -->
