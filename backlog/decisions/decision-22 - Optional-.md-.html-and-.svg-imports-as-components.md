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

## Amendment (user answers, 2026-10-08)

- **Markdown stays plain Markdown** (CommonMark + GFM). There is no MDX for now.
- **`<script>` in `.html` runs as a client module**, which some web components need. It is bundled by Vite and loaded on the client wherever the component is rendered, the same way an island module would be.
- **`<style>` in `.html`/`.md`** was delegated to Lux, who chose the least surprising rule:
  - Top-level `<style>` elements are scoped to that file's content, like a top-level block in `.stsx`, and `<style global>` opts out.
  - `<style>` inside `<template>` (a web component's shadow DOM) or inside `<svg>` is left verbatim and never scoped or extracted.
  - `$refs` are not available, because there is no JS scope.
- **Layouts come only from folders**; frontmatter cannot select a layout.
- **Frontmatter is optionally typed with schemas the user defines**, so Lumen ships no built-in schemas. The mechanism is pending the user's confirmation.
- **Frontmatter typing (confirmed by the user):** Lumen has no opinion and ships no schema conventions.
  - Frontmatter is exported as plain data, typed `Record<string, unknown>`.
  - Users can validate it at build time through an optional hook, `lumen({ md: { frontmatter(data, { file }) { …; return data } } })`. Throwing fails the build with file context.
  - For static types, users augment `declare module "*.md"` themselves, or validate at the import site.
- **SVG (user decision, 2026-10-08, after the TASK-70 study):** `.svg` imports are inline components by default, with the query switches `?inline`, `?url` and `?raw`. There is **no sprite mode**. Build-time optimisation is configurable through `lumen({ svg: { optimize } })`.
  - **Amended by decision-46 (2026-10-14):** an `.svg` import is a component only with `?component`, in the project and in `node_modules`. A bare import and `?inline` are Vite's again.
- **TASK-69 semantics (confirmed by the user, 2026-10-09):**
  - A full `.html` document keeps its `<head>` styles and scripts.
  - A nested `<style>` in `.md`/`.html` scopes to its parent element's subtree (decision-23).
  - Frontmatter static types come from augmenting a `Frontmatter` interface.
  - **`<script>` is not supported in Markdown.** A `<script>` in a `.md` file is a build error with a diagnostic that points to an `.html` import or a component. Only `.html` imports run scripts.
