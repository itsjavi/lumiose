---
id: TASK-69
title: Support .md and .html imports as components
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 16:20'
labels:
  - needs-decision
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
- [ ] #1 Opt-in via lumen({ md: true | options, html: true }); import Post, { frontmatter } from './post.md' gives a static component (CommonMark + GFM, compiled in Rust, e.g. comrak or pulldown-cmark) plus a typed-as-unknown frontmatter export (YAML); headings get ids
- [ ] #2 import Card from './card.html' gives a static component; a full document contributes only its <body> inner content (title/meta mapped to Head is optional); fragments are used as-is
- [ ] #3 Type declarations for *.md and *.html modules (lumen/env); works in client and server builds and in dev with HMR; tests and docs (concept page)
- [ ] #4 Open syntax/DX questions answered by the user before implementing: MDX-style components in .md, <script>/<style> semantics in .html and .md, layout via frontmatter, typed frontmatter
<!-- AC:END -->
