---
id: TASK-463
title: 'Build: warn when a rendered component''s client script has no chunk'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 13:45'
updated_date: '2026-10-16 21:34'
labels:
  - vite
  - build
milestone: m-12
dependencies: []
priority: low
ordinal: 461000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-456 L36 (Prism). A component that calls its `?client` script (decision-63) during server rendering expects the build to emit that script and the page to load it; when the build has no chunk for it (an excluded package, a misconfigured optimizer), the page renders without the script and silently loses the behaviour. @lumiose/vite should warn at build time (or when prerendering) for a client script a rendered page needs but the client build did not emit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A build that renders a component whose client script has no chunk warns with the script and the page, with a test in packages/vite
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for the final M12 batch (no Photon session is running).

2026-10-16 (Beacon): Done. The server build already warned once per script when a ?client module had no built chunk ("the client build did not build it"), but not which page loses it. Now the server stub for such a script calls missingClientScript (packages/lumiose/src/app/server/missing-client-script.ts): when a page renders the component, it warns once per script with the script and the page (from the request scope), while prerendering and on the server. Test: packages/vite build.test.ts 'warns when a page renders a component whose client script the build did not build (TASK-463)': an app in app/ importing a module outside its root (the scan does not reach it) with a ?client import: the build warning, then exactly one render warning naming "/", the page still renders without the script. Fails without the stub change. Docs: concepts/islands.md (Builds).
<!-- SECTION:NOTES:END -->
