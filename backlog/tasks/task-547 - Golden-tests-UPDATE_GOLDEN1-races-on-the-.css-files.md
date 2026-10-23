---
id: TASK-547
title: 'Golden tests: UPDATE_GOLDEN=1 races on the .css files'
status: Done
assignee:
  - Photon
created_date: '2026-10-23 21:34'
updated_date: '2026-10-23 22:48'
labels:
  - compiler
  - tests
dependencies: []
priority: low
ordinal: 539000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found during TASK-536. `UPDATE_GOLDEN=1 cargo test --test codegen_golden` can fail in update mode only: the client and server golden tests run in parallel and race on the same .css files. Running `-- server_goldens` alone works around it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Updating the goldens works in one run (serialize the writers, or write each side's CSS once)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon: the client and server tests ran in parallel; in update mode the client test rewrote <name>.css while the server test read it to compare. One test, codegen_goldens, now compiles each fixture for both targets, writes the .css golden once from the client result, compares the server CSS in memory, and in update mode removes a .css golden whose fixture no longer has styles. Checked: cargo test --test codegen_golden (normal and UPDATE_GOLDEN=1, no golden changes; a planted stale .css is removed), cargo fmt, clippy -D warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
codegen_golden runs both targets in one test, so UPDATE_GOLDEN=1 cargo test -p lumiose_compiler --test codegen_golden updates every golden in one run; stale .css goldens are removed in update mode.
<!-- SECTION:FINAL_SUMMARY:END -->
