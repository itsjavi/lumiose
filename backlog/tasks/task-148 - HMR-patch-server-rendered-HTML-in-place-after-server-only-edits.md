---
id: TASK-148
title: 'HMR: patch server-rendered HTML in place after server-only edits'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 05:24'
updated_date: '2026-10-12 19:31'
labels:
  - dev
  - hmr
milestone: m-9
dependencies:
  - TASK-147
priority: high
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: a 1.0 must-have (smoother dev reload); was planned only on 2026-10-09. After an edit to a server-only component, fetch the current URL's fresh HTML and morph the page DOM in place (keeping islands' DOM and state, focus and scroll) instead of a full reload, similar in spirit to React Router's hot data revalidation. Fall back to a reload when the document/head structure changes. Main risk: keeping hydration markers intact while patching.
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

Lux 2026-10-12: revived by the user (1.0 must-have, replaces the 2026-10-09 deferral). Default in dev, no option, full reload as the fallback when the document/head structure changes. Starts after TASK-253 lands (both touch packages/vite/src/app).
<!-- SECTION:NOTES:END -->
