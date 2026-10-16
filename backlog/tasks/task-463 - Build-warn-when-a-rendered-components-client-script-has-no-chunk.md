---
id: TASK-463
title: 'Build: warn when a rendered component''s client script has no chunk'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-16 13:45'
updated_date: '2026-10-16 15:39'
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
- [ ] #1 A build that renders a component whose client script has no chunk warns with the script and the page, with a test in packages/vite
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.
<!-- SECTION:NOTES:END -->
