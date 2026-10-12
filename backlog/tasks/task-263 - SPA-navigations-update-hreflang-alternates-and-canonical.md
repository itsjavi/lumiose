---
id: TASK-263
title: SPA navigations update hreflang alternates and canonical
status: To Do
assignee:
  - Spark
created_date: '2026-10-12 21:46'
labels:
  - i18n
  - spa
  - head
dependencies:
  - TASK-256
priority: low
ordinal: 265000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split from TASK-261 item 1 (found in TASK-254). The server writes hreflang alternates and the automatic canonical for pages that declare locales, but lumiose/router SPA navigations keep the previous page's links. Update them on navigation (the canonical stays replaceable by a page's own, as on the server). Same client head code as TASK-256, so it follows it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After an SPA navigation, hreflang alternates and the canonical match the new page (none for undeclared locales)
- [ ] #2 Tests in happy-dom; runtime size stays under its cap; docs updated
<!-- AC:END -->
