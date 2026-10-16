---
id: TASK-349
title: LUM2001 flags useId() inside an object literal used in JSX
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-15 12:36'
updated_date: '2026-10-16 23:19'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 351000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike (removed in TASK-363; it remains in the git history). LUM2001 (a non-reactive value read in JSX) is reported for a useId() call inside an object literal that is spread or passed in JSX, although useId() returns a constant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 useId() inside an object literal used in JSX reports no LUM2001
- [x] #2 A compiler test covers it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-17 (branch claude/photon-bugs-2c1927). Reproduced on main: `const context = { id: useId() }; <Ctx value={context}>` reported LUM2001, because a zero-argument call of an imported binding counts as a signal read.
Fix (analyze/reactivity.rs): lumiose's APIs that make a value or return a constant are never reads: useId, ref, signal, createContext, getAbortSignal (CONSTANT_APIS, next to the request and control-flow APIs). The language server's execution contract shows such calls as once, not tracked.
Test: golden constant-calls.tsx (useId in an object passed to a provider and in a spread object: no LUM2001; an object that also reads a prop still warns). Docs: errors/LUM2001.md.
Found: a stale object that reaches JSX only through a spread (`<div {...attrs} />`) is never reported, because spread arguments are not counted as JSX references. Follow-up TASK-466.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumiose's APIs that make a value or return a constant (useId, ref, signal, createContext, getAbortSignal) are no longer counted as signal reads, so an object literal with useId() used in JSX reports no LUM2001. Golden test constant-calls; LUM2001 docs updated. Follow-up TASK-466 for spreads the analyzer does not see.
<!-- SECTION:FINAL_SUMMARY:END -->
