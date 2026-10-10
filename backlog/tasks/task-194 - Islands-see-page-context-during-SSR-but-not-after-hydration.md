---
id: TASK-194
title: Islands see page context during SSR but not after hydration
status: To Do
assignee:
  - Nova
created_date: '2026-10-10 03:33'
labels:
  - bug
  - islands
dependencies: []
priority: medium
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-10-10 (TASK-189). On the server an island renders under the page's owner (runComponent in src/server/frame.ts via island() in src/server/island.ts), so inject() sees context the page provided; in the browser hydrate() creates the island under createOwner(undefined) (src/dom/hydrate.ts), so inject() returns the default. Result: island HTML and hydrated state disagree. The fix must keep the internal contexts islands rely on during SSR (Suspense boundary, error handling, request). Options: hide user contexts from islands during SSR, and/or a dev diagnostic when an island injects a value provided outside it. Documented today as a common mistake in docs/concepts/state.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An island's inject() gives the same result on the server and after hydration; Suspense, error boundaries and request APIs inside islands still work
- [ ] #2 Dev diagnostic (registry code) when an island reads a context provided outside it, if that is the chosen fix; regression tests on both sides
- [ ] #3 Docs updated (islands and Sharing state pages)
<!-- AC:END -->
