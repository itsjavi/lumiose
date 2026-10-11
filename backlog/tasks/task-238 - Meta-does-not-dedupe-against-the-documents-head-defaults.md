---
id: TASK-238
title: Meta does not dedupe against the document's head defaults
status: To Do
assignee:
  - Nova
created_date: '2026-10-11 03:33'
labels:
  - seo
  - head
dependencies: []
priority: low
ordinal: 240000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-213: every page of apps/web has two <meta name="description">: apps/web/src/document.tsx renders a default, and the page's <Meta name="description"> adds a second instead of replacing it (the docs say Metas with the same name dedupe, deepest wins). Decide whether <Meta> should replace a matching element from the Document's static head during SSR, or whether the site should drop the default; fix and test (lumiose app/head, Nova).
<!-- SECTION:DESCRIPTION:END -->
