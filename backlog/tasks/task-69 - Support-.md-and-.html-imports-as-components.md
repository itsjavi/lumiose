---
id: TASK-69
title: Support .md and .html imports as components
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 16:23'
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
- [ ] #4 Frontmatter is optionally typed via user-defined schemas (mechanism per the user confirmation recorded in decision-22); untyped frontmatter is Record<string, unknown>
- [ ] #5 Type declarations for *.md and *.html (lumen/env); works in client and server builds and in dev with HMR; tests; docs concept page
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: user answers recorded in the decision-22 amendment. Plain Markdown; html <script> runs as a client module; file-scoped <style> with <template>/<svg> left verbatim; layouts by folder only; user-defined frontmatter schemas (mechanism pending confirmation).
<!-- SECTION:NOTES:END -->
