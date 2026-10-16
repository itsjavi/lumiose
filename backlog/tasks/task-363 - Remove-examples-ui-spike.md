---
id: TASK-363
title: Remove examples/ui-spike
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-16 01:27'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-355
  - TASK-357
  - TASK-358
priority: low
ordinal: 364000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Delete the spike app and its CI suite once Dialog, Menu and Combobox replace it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 examples/ui-spike is removed and CI no longer runs it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 7 (the idle Beacon session takes it; it may edit the files the task needs).

2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55, batch 7): done in b6b16e45.

- examples/ui-spike is deleted, together with its build output and test results. CI's e2e job finds suites by `examples/*/playwright.config.ts`, so it no longer runs the spike's; no workflow named it.
- pnpm install (under deps.lock) drops the importer and `@timelessui/components`, `/core` and `/color` from pnpm-lock.yaml (49 lines).
- References:
  - decision-62's Context says the spike was removed in TASK-363 and remains in the git history.
  - So do the open tasks that point to it (TASK-347, 348, 349, 361, 362, by description).
  - TASK-283 got a note, because its mention is in its notes.
  - Done tasks keep their history as written.
- Lux had already moved the local showcase's launch config to examples/ui-e2e (e2dba132).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
examples/ui-spike and its lockfile entries are removed; CI no longer runs it; decision-62 and the open tasks note the removal (b6b16e45). Checks: pnpm check (2334 tests), pack:check --smoke --skip-npm (@lumiose/ui 128 files), ui-e2e 646 passed (18 skipped), apps/web 171 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
