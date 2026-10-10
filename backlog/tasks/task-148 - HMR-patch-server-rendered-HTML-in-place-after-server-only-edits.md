---
id: TASK-148
title: 'HMR: patch server-rendered HTML in place after server-only edits'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 05:24'
updated_date: '2026-10-10 02:29'
labels:
  - dev
  - hmr
dependencies:
  - TASK-147
priority: low
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planned only (user 2026-10-09: 'plan only') — do not start without the user's go-ahead. After an edit to a server-only component, fetch the current URL's fresh HTML and morph the page DOM in place (keeping islands' DOM and state, focus and scroll) instead of a full reload, similar in spirit to React Router's hot data revalidation. Fall back to a reload when the document/head structure changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server-only component edits update the page without a reload; islands and scroll survive; head changes apply
- [ ] #2 Fallback to reload on structural changes; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: deferred (user accepted the pushback): DOM morphing after server edits risks unexpected behaviour; keep the full reload.

Status: deferred (user accepted, 2026-10-09). Not planned.
<!-- SECTION:NOTES:END -->
