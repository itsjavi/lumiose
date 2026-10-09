---
id: TASK-135
title: LUM2001 false positive on control-flow calls in server pages (?? notFound())
status: Done
assignee:
  - Photon
created_date: '2026-10-09 04:36'
updated_date: '2026-10-09 04:55'
labels:
  - compiler
dependencies: []
priority: low
ordinal: 135000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building the fullstack bench Lumen app (TASK-112). In a server page, `const project = getProject(slug) ?? notFound();` warns LUM2001 ('computed once from a reactive value'): the compiler treats the zero-argument call `notFound()` (imported from lumen) as a signal read. redirect(), notFound() and error() never return a value, so they should not count as reads (like the request APIs listed in LUM2001's docs). Workaround used: `if (project === undefined) notFound();`. Related: zero-argument calls of functions imported from a workspace data package (`getDashboard()` from @bench/data) also count as signal reads in server pages; re-exporting them from src/server/ avoids it. Consider documenting that in LUM2001.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 notFound(), redirect() and error() calls do not make a derived const a reactive read (no LUM2001)
- [x] #2 LUM2001 docs mention the src/server/ re-export for server data packages
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): analyze/reactivity.rs: lumen's control-flow APIs (notFound, redirect, error) join the request APIs as bindings whose calls are not reactive reads, so `getProject(slug) ?? notFound()` no longer warns; a real signal read next to them still does. Test compile_api control_flow_apis_are_not_reactive_reads. Docs: errors/LUM2001.md lists the control-flow APIs and the src/server/ re-export for workspace data packages (no compiler change for those: a bare package cannot be known server-only).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
notFound()/redirect()/error() are not reactive reads for LUM2001; LUM2001 docs explain re-exporting workspace data functions from src/server/.
<!-- SECTION:FINAL_SUMMARY:END -->
