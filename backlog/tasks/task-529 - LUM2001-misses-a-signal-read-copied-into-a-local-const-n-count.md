---
id: TASK-529
title: LUM2001 misses a signal read copied into a local (const n = count())
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-23 09:31'
updated_date: '2026-10-23 19:35'
labels: []
dependencies: []
priority: medium
ordinal: 522000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while implementing TASK-523: `const n = count()` in a component body is not reported by LUM2001, although the agent guidance (AGENTS.md block and the lumiose skill) says LUM2001 warns when a signal's value is copied once at setup. Either make LUM2001 report it (and decide how it interacts with decision-77's split) or correct the guidance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LUM2001 reports const n = count() at setup, with a golden test, or the guidance no longer claims it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-23): LUM2001 now reports it. analyze/reactivity.rs accessor_bindings(): bindings (anywhere in the module, never reassigned) declared from lumiose's signal/computed/resource/optimistic; analyze/mod.rs derivation(): a zero-argument call of one (const n = count()) is a Signal read instead of a factory call. LUM2003's derived locals use the same derivation, so if (n > 9) return null is an error through the local (decision-77). Zero-argument calls of imported functions stay unreported: total() may be a store module's signal or a plain function, and useCart() a defineState getter (named false positives), so only accessors made in the file count. Also: count.peek() was itself reported by LUM2001 although the LUM2001 page recommends it for an intentional snapshot; strongest_read() (LUM2001/LUM2003 only, not the execution contract) no longer counts a zero-argument .peek() call as a read. Tests: compile_api.rs zero_argument_calls_of_accessors_are_stale_copies; diagnostics.tsx golden gains a Counter component. Docs: errors/LUM2001.md (what counts, imports, peek/untrack, example), errors/LUM2003.md (signal bullet). Guidance in the agents block and signals.md is now accurate for signals made in the file; no wording change needed. Repo scan (lumiose check, new binding): apps/web, all examples, packages/ui, packages/site-kit, benchmarks/fullstack/apps/lumiose: no new warnings (apps/web keeps its one LUM2003 warning from TASK-523).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM2001 now reports a signal's value copied into a local at setup (const n = count()) when count is a signal, computed, resource or optimistic made in the same file; LUM2003's derived locals follow (an early return on n is an error, decision-77). Imported zero-argument calls stay unreported (store signal, plain function or defineState getter cannot be told apart). count.peek() is no longer a read for LUM2001/LUM2003, as the LUM2001 page already promised. Tested in compile_api.rs and the diagnostics golden; docs in errors/LUM2001.md and errors/LUM2003.md. No new warnings in apps/web, the examples, packages/ui, site-kit or the fullstack app; pnpm check green.
<!-- SECTION:FINAL_SUMMARY:END -->
