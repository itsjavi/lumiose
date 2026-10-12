---
id: TASK-256
title: SPA navigations bring back the document's head defaults
status: Done
assignee:
  - Spark
created_date: '2026-10-12 19:48'
updated_date: '2026-10-12 22:03'
labels:
  - seo
  - head
  - spa
dependencies: []
priority: low
ordinal: 258000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up of TASK-238 (found by Nova). The server now treats the <title>/<meta> tags of src/document.stsx (and the default document's charset/viewport) as defaults that a page's <Title>/<Meta> replace in place. The document renders on the server only, so in the browser a default that a page replaced is gone: after an SPA navigation to a page without its own <Meta name=description>, the description is removed instead of falling back to the document's; and the client <Title> keeps the previous page's title when the next page has none (pre-existing). The docs (concepts/head) say so and recommend <Title>/<Meta> in the outermost spa layout for SPA defaults. To restore the document's defaults on the client, the server must tell the client which head tags are document defaults and what a replaced default was (for example a marker attribute on default tags plus the replaced default on the replacing tag, or the defaults in the SPA payload); src/dom/head.ts then restores them when the last <Title>/<Meta> of a key goes. Needs an output-format decision (Lux) and a runtime size check (src/dom is Spark's area).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After an SPA navigation away from a page that replaced a document default, the default title/meta comes back
- [x] #2 No duplicate tags; server HTML for pages without overrides unchanged or the change justified
- [x] #3 Docs (concepts/head) updated; runtime size stays under its cap
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: output format delegated to Spark (record it in the task): prefer a marker attribute on server-rendered default head tags plus the replaced default carried by the replacing tag, over growing the SPA payload; justify bytes; runtime cap applies. Spark may edit app/server/document.ts for the server side.

Spark 2026-10-13: solo takeover not needed (assigned). Output format chosen (Lux delegated it):
- Server (app/server/document.ts): a page tag that replaces a document default carries the default HTML as written in a last attribute, single-quoted: data-l-default='&lt;meta name="description" content="Site"&gt;'. & and ' are escaped to keep the value, < and > so scrapers that match tags in the source never see the carried tag (and the page attributes come first). Only replacing tags carry it: pages without overrides keep byte-identical HTML (no marker on default tags, no SPA payload growth). Cost per replaced default: its tag length + 18 bytes + 6 per carried tag bracket pair (title: about 47 bytes for <title>Site</title>).
- Client (dom/head.ts): the marker on defaults is not needed because the client tells a default from a page tag by when it adopts it: a tag adopted outside hydration (navigation, CSR shell, mismatch fallback) is the default (document or server-only layout) and is cloned; a tag adopted while hydrating is the page own and its default is the parsed data-l-default (template element), or none. When the last <Meta> of a key goes, the element is replaced with its default (an empty fragment when none); the title goes back to the default title (the carried one while hydrating, else document.title before the first <Title>). The previous-title-sticks behaviour is fixed too.
- Size: core + dom (every export) min+brotli 10124 -> 10182 bytes (+58; cap 10240, 58 left). The parsing and the hydration branches fold away in bundles without hydration.
- Limitation (documented in concepts/head): a <Title>/<Meta> of a layout outside the SPA that the first, hydrated page replaced on the server does not come back (the server dedupes it without carrying it); the server head collector (src/server, Nova) would have to carry it. Defaults in the document or the outermost spa layout are fully covered.
Evidence: dom/head.test.ts (default meta and title restored, hydrated page tags removed and their carried defaults back), app/server/document.test.ts (carrier output, escaping, SPA navigation sequences with a hydrated first page), examples/spa-router-e2e: new src/document.tsx with title/description defaults, user pages add <Meta name=description>, new e2e spec (deep link /users/1, Home brings both defaults back, one tag each, no reload): 28/28 Playwright specs green under dev and build. pnpm test: 1781 passed, 1 failure was a docs llms-full race with another agent doc edit (docs:check green after). pnpm check stops at fmt:examples on examples/ssr-bookshelf/src/routes/(static)/about/page.stsx (TASK-236, another worker, uncommitted); typecheck, lint, node --test scripts, size run separately: green. No Rust changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SPA navigations bring the document's head defaults back. A page tag that replaces a default carries the default's HTML in data-l-default (escaped, last attribute); pages without overrides keep identical HTML. dom/head.ts treats a tag adopted outside hydration as the default (cloned) and one adopted while hydrating as the page's own (default = its parsed data-l-default), and restores the default when the last <Title>/<Meta> of a key goes (the title too, instead of keeping the previous page's). Runtime: every-export min+brotli +58 bytes (10182 of 10240). Tests: head and document unit tests, spa-router-e2e spec in dev and build. Docs: concepts/head, reference/components. Known limitation (documented): a server-only layout's tag that the first, hydrated page replaced does not come back.
<!-- SECTION:FINAL_SUMMARY:END -->
