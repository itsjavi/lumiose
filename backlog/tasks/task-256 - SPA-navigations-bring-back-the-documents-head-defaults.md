---
id: TASK-256
title: SPA navigations bring back the document's head defaults
status: To Do
assignee:
  - Spark
created_date: '2026-10-12 19:48'
updated_date: '2026-10-12 21:45'
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
- [ ] #1 After an SPA navigation away from a page that replaced a document default, the default title/meta comes back
- [ ] #2 No duplicate tags; server HTML for pages without overrides unchanged or the change justified
- [ ] #3 Docs (concepts/head) updated; runtime size stays under its cap
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: output format delegated to Spark (record it in the task): prefer a marker attribute on server-rendered default head tags plus the replaced default carried by the replacing tag, over growing the SPA payload; justify bytes; runtime cap applies. Spark may edit app/server/document.ts for the server side.
<!-- SECTION:NOTES:END -->
