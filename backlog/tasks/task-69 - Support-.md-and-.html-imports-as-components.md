---
id: TASK-69
title: Support .md and .html imports as components
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 21:34'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: user answers recorded in the decision-22 amendment. Plain Markdown; html <script> runs as a client module; file-scoped <style> with <template>/<svg> left verbatim; layouts by folder only; user-defined frontmatter schemas (mechanism pending confirmation).

Lux: reassigned to Halo (owner of asset-import transforms, after TASK-70 SVG imports). Markdown in Rust (pulldown-cmark or comrak) exposed via napi; the Vite plugin integration is in src/vite (Photon's area), so coordinate via notes or a small new module.
<!-- SECTION:NOTES:END -->
