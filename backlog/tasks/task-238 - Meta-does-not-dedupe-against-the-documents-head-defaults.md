---
id: TASK-238
title: <Title> and <Meta> replace the document's head defaults
status: Done
assignee:
  - Nova
created_date: '2026-10-11 03:33'
updated_date: '2026-10-12 19:49'
labels:
  - seo
  - head
milestone: m-9
dependencies: []
priority: high
ordinal: 240000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-213: every page of apps/web has two <meta name="description">: apps/web/src/document.tsx renders a default, and the page's <Meta name="description"> adds a second instead of replacing it. Same for <Title>. User 2026-10-12: fix both: the head collector treats the defaults in document.stsx as overridable, so a page's <Title> replaces the document's title and a page's <Meta> replaces the document's tag with the same name, property, charset or http-equiv (deepest wins, as the docs say). Lumiose app/head, Nova.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A page's <Title> replaces the document's default title; one <title> in the output
- [x] #2 A page's <Meta> replaces the document's tag with the same name, property, charset or http-equiv; no duplicates (SSR, streaming and SPA navigations)
- [x] #3 Docs (concepts/head) and tests; apps/web pages have one description
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (session nova-20261012T193251Z-t238), 2026-10-12:
- Where: the merge happens where the document and the collected head meet, packages/lumiose/src/app/server/document.ts (documentParts). The document's own <title>/<meta> tags in its <head> element (src/document.stsx, or the default document's charset + viewport) are the shallowest head level; a collected tag with the same key (title, charset, name/property/http-equiv/itemprop:value, the keys of <Title>/<Meta>) replaces the default in place (document tag order kept, so a page charset stays first); later defaults with the same key are dropped. Scripts, styles, templates, noscript, comments and the body are not scanned. No change to src/server (collector) or src/dom: SSR and streaming share documentParts, and the client <Meta> already adopts the one server tag, so SPA navigations keep one tag.
- Cost: needle precheck (default document: two includes per request) and a memo of the custom document's head tags; micro-bench documentParts ~+0.3 us default document, ~+1 us custom document with a replaced description.
- Known limit (documented in concepts/head): the document renders on the server only, so after an SPA navigation a default that a page replaced does not come back; SPA defaults belong in the outermost spa layout as <Title>/<Meta>. Restoring document defaults on the client would need the server to mark defaults in the HTML: proposal for Lux, not done here.
- Tests: src/app/server/document.test.ts (unit: in-place replacement, keys, scope, duplicates; server responses: complete, streamed, default document; SPA navigations with happy-dom). All 11 fail on HEAD's document.ts and pass with the fix. server-renderer.test.ts left alone (Nova-routes is renaming its route fixtures).

Evidence (Nova, 2026-10-12):
- Commit 7b8e044 (fix + tests + docs concepts/head, reference/components, llms-full.txt regenerated).
- apps/web built in an isolated worktree at 7b8e044 (main tree has the TASK-253 route rename in progress): 89 prerendered pages, each with exactly 1 <meta name=description>, 1 <title> and no duplicate meta key; 51 redirect stubs. Same build with the previous document.ts: 88 pages had 2 descriptions. apps/web/src/document.tsx unchanged.
- Checks in that worktree: pnpm typecheck, pnpm lint, node --test scripts, lumiose size: green. pnpm test: 1580 passed, 1 failed (compiler scan.test version 0.1.0 vs 0.2.0: the copied native binary predates the v0.2.0 bump; unrelated, pnpm build:compiler fixes it). fmt:check flags 7 files of other areas, none of mine. cargo not run (no Rust change). Docs: docs:gen/docs:check and packages/cli docs tests green.
- In the main tree, the server-renderer/handler/router tests currently fail because of the TASK-253 rename in progress; with and without this change the failure lists are identical apart from the new document.test.ts (failing on the old document.ts, passing now).
- Follow-up: TASK-256 (SPA navigations bring back the document's head defaults; needs an output-format decision).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The <title> and <meta> tags a document writes in its <head> (src/document.stsx, or the default document's charset and viewport) are now head defaults: in documentParts (packages/lumiose/src/app/server/document.ts), a collected tag with the same key (<Title>; <Meta> by charset/name/property/http-equiv/itemprop) replaces the default in place, so every page has one title and one tag per meta key, in complete and streamed responses; the client <Meta> adopts that one tag, so SPA navigations keep one. Tests in src/app/server/document.test.ts (unit, server responses complete/streamed/default document, SPA navigations). Docs: concepts/head (Head defaults paragraph, example with plain defaults) and reference/components. apps/web: 89 pages with exactly one description (88 had two before). Limitation documented and filed as TASK-256: a default that a page replaced does not come back after SPA navigations.
<!-- SECTION:FINAL_SUMMARY:END -->
