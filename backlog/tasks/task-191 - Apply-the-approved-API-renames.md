---
id: TASK-191
title: Apply the approved API renames
status: Done
assignee:
  - Lux
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 18:50'
labels:
  - api
  - dx
dependencies:
  - TASK-190
priority: high
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the renames the user approves from TASK-190 across the runtime, compiler-emitted imports if any, typings, language tooling, examples, apps, docs and llms.txt. Split into per-owner tasks once the list is approved.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every approved rename applied; old names removed or aliased as approved, with a changelog entry
- [x] #2 Docs, examples and diagnostics updated in the same commits; pnpm check green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 Lux: split into TASK-191.1 (runtime, Vite plugin, lumiose docs, provider; Spark) and TASK-191.2 (consumer sweep; Beacon, after 191.1).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Applied every decision-35 rename outright (no aliases): runtime, Vite HMR detection, compiler tests, diagnostics and docs in TASK-191.1 (c07d91e, with the <Ctx value> provider and docs/upgrading.md migration table); consumers in TASK-191.2 (examples, benchmarks, evals, tooling). Breaking commits use '!' so the release changelog lists them. pnpm typecheck/test green; size 9.95 kB under the 10 kB cap.
<!-- SECTION:FINAL_SUMMARY:END -->
