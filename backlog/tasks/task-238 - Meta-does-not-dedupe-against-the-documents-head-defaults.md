---
id: TASK-238
title: <Title> and <Meta> replace the document's head defaults
status: In Progress
assignee:
  - Nova
created_date: '2026-10-11 03:33'
updated_date: '2026-10-12 19:45'
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
- [ ] #1 A page's <Title> replaces the document's default title; one <title> in the output
- [ ] #2 A page's <Meta> replaces the document's tag with the same name, property, charset or http-equiv; no duplicates (SSR, streaming and SPA navigations)
- [ ] #3 Docs (concepts/head) and tests; apps/web pages have one description
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (session nova-20261012T193251Z-t238), 2026-10-12:
- Where: the merge happens where the document and the collected head meet, packages/lumiose/src/app/server/document.ts (documentParts). The document's own <title>/<meta> tags in its <head> element (src/document.stsx, or the default document's charset + viewport) are the shallowest head level; a collected tag with the same key (title, charset, name/property/http-equiv/itemprop:value, the keys of <Title>/<Meta>) replaces the default in place (document tag order kept, so a page charset stays first); later defaults with the same key are dropped. Scripts, styles, templates, noscript, comments and the body are not scanned. No change to src/server (collector) or src/dom: SSR and streaming share documentParts, and the client <Meta> already adopts the one server tag, so SPA navigations keep one tag.
- Cost: needle precheck (default document: two includes per request) and a memo of the custom document's head tags; micro-bench documentParts ~+0.3 us default document, ~+1 us custom document with a replaced description.
- Known limit (documented in concepts/head): the document renders on the server only, so after an SPA navigation a default that a page replaced does not come back; SPA defaults belong in the outermost spa layout as <Title>/<Meta>. Restoring document defaults on the client would need the server to mark defaults in the HTML: proposal for Lux, not done here.
- Tests: src/app/server/document.test.ts (unit: in-place replacement, keys, scope, duplicates; server responses: complete, streamed, default document; SPA navigations with happy-dom). All 11 fail on HEAD's document.ts and pass with the fix. server-renderer.test.ts left alone (Nova-routes is renaming its route fixtures).
<!-- SECTION:NOTES:END -->
