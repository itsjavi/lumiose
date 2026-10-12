---
id: TASK-238
title: <Title> and <Meta> replace the document's head defaults
status: To Do
assignee:
  - Nova
created_date: '2026-10-11 03:33'
updated_date: '2026-10-12 18:40'
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
