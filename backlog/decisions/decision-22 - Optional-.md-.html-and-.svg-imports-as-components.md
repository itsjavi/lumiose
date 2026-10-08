---
id: decision-22
title: 'Optional .md, .html and .svg imports as components'
date: '2026-10-08 16:20'
status: accepted
---
## Context

The user wants to import Markdown (blogs and content) and HTML (for example web components defined in single `.html` files) as Lumen components. They also want SVG imports as components, since almost every modern app needs icons, and want an automatic sprite strategy studied so the final HTML stays lean. They approved this scope on 2026-10-08.

## Decision

- **`.md` and `.html` imports are optional build-time transforms** that produce static Lumen components. They are opt-in through `lumen({ md, html })`. Being build-time transforms, they work the same in SPA, SSR and SSG.
  - Markdown imports export `frontmatter` alongside the component.
  - An HTML file that is a full document contributes only the inner content of its `<body>`.
- **`.svg` imports are components**, with automatic sprite deduplication. The approach is chosen after a study, tracked in TASK-70.
- **Not decided yet**, left to the user as syntax/DX decisions:
  - MDX-style components inside `.md`;
  - `<script>` and `<style>` semantics in `.md`/`.html`;
  - choosing a layout via frontmatter, and typed frontmatter;
  - file-based routing for `.md`/`.html` pages (including in SPA mode, possibly with a hash router).

## Consequences

- The compiler gains a Markdown pipeline (Rust) and an HTML-fragment pipeline. Both reuse the static-template codegen.
- Type declarations for `*.md`, `*.html` and `*.svg` modules ship in `lumen/env`.
