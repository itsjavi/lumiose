---
id: TASK-146
title: 'HMR: component-level refresh for client components'
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 05:24'
updated_date: '2026-10-09 12:12'
labels:
  - dev
  - hmr
dependencies: []
priority: low
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planned only (user 2026-10-09: 'plan only') — do not start without the user's go-ahead. Today an edit re-mounts the whole SPA (component state resets) or reloads SSR pages. In dev, the compiler registers each component in a hot registry and wraps its uses in a proxy; on update, only instances of the changed component are disposed and re-created in place, so parents and siblings keep their state (module-level signals already survive). Similar to solid-refresh. Dev-only; no public API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Editing a component re-creates only its instances; sibling/parent signals and DOM state survive; works in SPA routes and islands
- [ ] #2 Falls back to a re-mount/reload when a module's exports change shape; zero production cost; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-09: approved (no hacks; fall back to the current reload when a change cannot be applied safely).
<!-- SECTION:NOTES:END -->
