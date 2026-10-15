---
id: TASK-343
title: 'Fuzz workflow: targets fail to build on the CI runner'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 08:02'
labels:
  - security
  - fuzzing
  - ci
milestone: m-11
dependencies: []
priority: high
ordinal: 345000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the first manual run of the nightly fuzz workflow (TASK-311, https://github.com/itsjavi/lumiose/actions/runs/38700307868). Every fuzz target job fails while building: cargo fuzz on nightly Rust targets x86_64-unknown-linux-musl, whose standard library is not installed ("can't find crate for core", E0463), so no target ran. Make the fuzz jobs build and run on the runner (install the target, or build for the host target), keeping AddressSanitizer, and confirm with one manual run of the workflow after the fix is pushed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every fuzz target builds and runs for its time budget in the workflow
- [ ] #2 One manual run after the fix passes, or its findings are tracked as tasks
- [ ] #3 CONTRIBUTING.md's Fuzzing section stays accurate
<!-- AC:END -->
