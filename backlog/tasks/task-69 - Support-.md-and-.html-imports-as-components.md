---
id: TASK-69
title: Support .md and .html imports as components
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 22:32'
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
- [x] #1 Opt-in via lumen({ md: true | options, html: true }); import Post, { frontmatter } from "./post.md" gives a static component (plain CommonMark + GFM, no MDX, compiled in Rust, e.g. comrak or pulldown-cmark), with heading ids; frontmatter (YAML) exported
- [x] #2 import Card from "./card.html" gives a component; a full document contributes only its <body> inner content; fragments are used as-is; <script> elements run as client modules (bundled by Vite and loaded on the client wherever the component renders, like island modules), which web components need
- [x] #3 Top-level <style> in .html/.md files is scoped to that file content (like .stsx top-level blocks; <style global> opts out); <style> inside <template> or <svg> is left verbatim; no $refs
- [x] #4 Type declarations for *.md and *.html (lumen/env); works in client and server builds and in dev with HMR; tests; docs concept page
- [x] #5 Frontmatter: exported as plain data typed Record<string, unknown>; optional build-time hook lumen({ md: { frontmatter(data, { file }) } }) for user validation/transformation (errors fail the build with file context); no built-in schema conventions; docs show validating with any library and augmenting declare module "*.md"
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. crates/lumen_content (Halo, new): Markdown with comrak 0.55 (CommonMark + GFM tables, strikethrough, task lists, autolinks, footnotes; raw HTML kept; +~680 KB vs pulldown-cmark +~550 KB without GFM autolinks) -> HTML; HTML (and the Markdown output) parsed with html5ever (spec tree building: implied tags, template contents, SVG names) -> the .stsx source of a static component: text as JS strings, attributes as strings, full documents -> <body> children (+ head <style>/<script>), top-level <style> -> file-level blocks (<style global> kept), nested <style> in place (subtree scope, as .stsx), <template>/<noscript> content and data-block <script>s verbatim via innerHTML, svg <style> verbatim, JS <script>s removed and listed; Markdown heading ids (GitHub slugs, deduplicated); frontmatter split off and returned raw. 2. napi contentSource(source, filename, kind) -> { code, frontmatter, scripts }. 3. src/vite/content.ts: resolveId maps ./x.md and ./x.html imports (not HTML entries) to the virtual Lumen module <file>.stsx, compiled by the main transform (styles, CSS manifest, islands, HMR via addWatchFile); <file>?lumen-frontmatter (YAML via the yaml package, lumen({ md: { frontmatter } }) hook, serialized as JS data); scripts: the component renders <Script client:load /> from <file>?lumen-script (client: imports the scripts; server: an empty island), so pages load them like island modules; index.ts/scan.ts get small hooks (content source for style loads and the build scan). 4. lumen/env types for *.md and *.html. 5. Tests (Rust goldens compiled for both targets, robustness; Vite dev server: client/ssr, frontmatter hook + errors, scripts island, styles, HMR graph), docs concept page + reference.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: user answers recorded in the decision-22 amendment. Plain Markdown; html <script> runs as a client module; file-scoped <style> with <template>/<svg> left verbatim; layouts by folder only; user-defined frontmatter schemas (mechanism pending confirmation).

Lux: reassigned to Halo (owner of asset-import transforms, after TASK-70 SVG imports). Markdown in Rust (pulldown-cmark or comrak) exposed via napi; the Vite plugin integration is in src/vite (Photon's area), so coordinate via notes or a small new module.

IMPLEMENTED (Halo, 2026-10-09).
RUST: new crate crates/lumen_content (Halo): markdown(source, name) / html(source, name) -> Component { source (.stsx), frontmatter (raw YAML), scripts }. Markdown: comrak =0.55.0 (default features off; CommonMark + GFM tables, strikethrough, task lists, autolinks, footnotes; render.unsafe so raw HTML is kept, no tag filter) -> HTML. Chosen over pulldown-cmark, which has no GFM extended autolinks (sizes measured in a fat-LTO cdylib: comrak +682 KB, pulldown-cmark +550 KB). HTML (and the Markdown output) parsed by html5ever =0.40.1 with an own arena-free Rc sink (src/dom.rs; iterative Drop) -> JSX: text as JS strings, attributes as strings, names JSX cannot write (@click, x-on:click.prevent, key/ref) via a spread; full documents (doctype or html/head/body tag) -> body children + head <style> and client scripts (rest of head dropped); fragments parsed in <template> context; top-level <style> -> file-level blocks (<style global> kept), nested <style> in place (subtree scope, as .stsx), <template>/<noscript>/raw-text content and data-block scripts verbatim via innerHTML, svg <style> verbatim; JS scripts (no type, module, JS MIME) removed and listed; <pre>/<textarea> leading newline preserved; depth capped at 512. Markdown heading ids: GitHub slugs, existing ids reserved, -1/-2 dedup. Frontmatter split (--- ... --- or ...) before rendering. Tests: 7 unit, golden fixtures (post.md, scripted.md, card.html, page.html; each compiled by lumen_compiler for both targets with zero diagnostics), robustness (odd input, 20k-deep nesting, truncated fixtures). napi contentSource(source, filename, kind) in lumen_napi.
SIZE: release napi binary 11,816,480 B (after TASK-96) -> 12,874,848 B (gzip -9 4.12 MB), about +1.06 MB for comrak + html5ever (working tree also holds other agents' compiler changes). html5gum + a hand-written tree builder would save ~400 KB at the cost of spec tree construction; not done.
VITE (src/vite/content.ts, Halo): resolveId maps ./x.md / ./x.html imports (not HTML entries: root index.html, HTML build inputs, publicDir) to the virtual Lumen module <file>.md.stsx, whose load returns the generated .stsx; the main transform compiles it like any .stsx (CSS modules, CSS manifest, islands registry). <file>.md?lumen-frontmatter: YAML (yaml ^2.9.1, 1.2 core) -> lumen({ md: { frontmatter(data, { file }) } }) hook (may be async; undefined keeps data; throws -> build error 'frontmatter: ...' with the file) -> JS data (JSON + undefined/BigInt/Date/URL/RegExp/Map/Set; other values are an error with the path). Scripts: the component renders <Script client:load /> from <file>.html?lumen-script: client env imports the scripts (src relative to the file, inline ones as ?lumen-script&index=N&lang.js), server env exports only the empty component, so SSR pages load them via the island loader (once per page) and client renders with the component module. HMR: the source file is a watch file of the module and of its CSS module; hotUpdate invalidates <file>.stsx modules in each environment (Vite only invalidates modules of the changed file); files with scripts full-reload. Edits to Photon's files (minimal, noted): index.ts (content plugin registration, content modules in the transform filter and OXC exclude, style load reads content.source + watches the file, scan gets content), scan.ts (content files compiled as their module id), options.ts (md/html, committed b91fe95). Nova's app/dev/plugin.ts: island preload URLs of module ids with a query get Vite's '?import&q' form (was 'x?q?import', a 404 preload). Types: packages/lumen/src/jsx/content-modules.d.ts (Beacon's dir; env.d.ts one-line import): *.md default component + frontmatter: Frontmatter (interface extends Record<string, unknown>, which projects merge fields into: declare module '*.md' { interface Frontmatter { title: string } } - redeclaring the const would conflict), *.html default component.
VERIFIED: content.test.ts (real dev server: resolution on/off, client/ssr modules, CSS module scoped, frontmatter hook + errors, SSR render with island record, scripts module per env, watch graph, scan), content.dom.test.ts (happy-dom: client render of md/html, verbatim template, server/client markup parity, scripts island via loadIslands), JSX type fixtures (content.tsx + Frontmatter merging). Manual: scratch app (.local/agents/Halo/.../app) 'lumen build' -> page with loader, modulepreload of the script chunk, both scoped CSS assets, island record; 'lumen dev' -> page renders, script module served, md body/frontmatter edits re-render SSR, CSS edits hot-update. Runs: cargo test --workspace 0 failures, clippy --workspace -D warnings clean, fmt clean; pnpm lint clean; vite/jsx/dev tests green. pnpm test / typecheck currently fail only from Nova's in-progress TASK-101 (href.ts declares ImportMetaEnv.BASE_URL: TS2687 with env.d.ts, and pulls server/scope.ts node:async_hooks into consumer type checks) - not from this task.
DECISIONS FOR LUX (semantics not spelled out in decision-22, chosen as least surprising; please confirm or record): (1) a full document also contributes its head's <style> elements and client scripts (other head content dropped); (2) <style> nested inside an element scopes to that subtree, as in .stsx (top-level = file scope per the decision); (3) <script> in Markdown (raw HTML) follows the .html rule (client module); (4) <noscript> content is verbatim like <template>; (5) frontmatter typing by merging into the Frontmatter interface of declare module '*.md'.
FOLLOW-UPS: TASK-107 (bundle relative asset URLs in md/html markup). Nova (examples/ssg-travel-journal/src/content.ts) and Beacon (apps/web content loading) can switch their content modules from marked + yaml to native .md imports with lumen({ md: { frontmatter } }) and import.meta.glob; their files, not changed here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
.md and .html imports are components behind lumen({ md, html }). Rust crate lumen_content (comrak GFM + html5ever) generates the .stsx of a static component (heading ids, file-scoped top-level <style>, verbatim <template>, scripts listed), exposed as napi contentSource; the Vite plugin maps imports to virtual <file>.md.stsx Lumen modules compiled by the main pipeline (styles, CSS manifest, islands, HMR), exports frontmatter from YAML through the optional build-time hook, and loads <script>s as client modules through an empty client:load island. Types in lumen/env (mergeable Frontmatter), docs concept page + references, tests at every layer. Binary +~1.06 MB.
<!-- SECTION:FINAL_SUMMARY:END -->
