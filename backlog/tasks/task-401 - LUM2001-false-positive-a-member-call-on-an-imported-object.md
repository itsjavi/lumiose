---
id: TASK-401
title: 'LUM2001 false positive: a member call on an imported object'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 21:48'
updated_date: '2026-10-16 00:21'
labels:
  - compiler
  - lum2001
milestone: m-12
dependencies: []
priority: medium
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-371 (Beacon, 2026-10-15). Inside a component, `const toasts = Toast.createToastManager();` warns LUM2001 ("`toasts` is computed once from a reactive value"), though nothing reactive is read. The same call through a named import (`createToastManager()`), wrapped in `untrack`, or at module scope does not warn. The analysis seems to treat any member call on an import (`X.y()`) as a reactive read, like a props access. Workaround in @lumiose/ui: a named export `createToastManager`, and docs/toast.md tells users to call it in components. Fix the analysis so a call on a module import is not reactive unless its arguments are, and add a compiler test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A member call on an imported module object inside a component does not warn LUM2001
- [x] #2 Reading a reactive prop through a member call still warns
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Photon (compiler), in M12, where it was found.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 6. New sessions cannot start from an automated turn, so the idle Beacon session takes it; it may edit the files the fix needs.

2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55, solo takeover in batch 6): fixed in 02e63dde.

Cause: `check_stale_declarator` (crates/lumiose_compiler/src/analyze/mod.rs) treats a constant set straight from a call with an identifier callee (`signal(props.start)`, `createToastManager()`) as a factory call. `Toast.createToastManager()` has a member callee, so the whole init went to `first_reactive_read`, whose zero-argument call of an imported binding counts as a signal read.

Fix: a call whose callee is a static member chain rooted at an import binding (`reactivity::is_import_member`, `SymbolFlags::Import`) is also a factory call, unless one of its arguments reads a reactive value.
- `format.date(props.date)` still warns.
- `props.name.toUpperCase()` (props-rooted) still warns.
- Calls on local objects (`user.name()`) are unchanged.

Tests: compile_api.rs `member_calls_on_imported_modules_are_factory_calls` (`Toast.createToastManager()`, `format.intl.create()`, plus the two that still warn). Checks: cargo fmt, clippy `-D warnings` and `cargo test --workspace` are green, and the napi binding is rebuilt.

Docs: errors/LUM2001.md explains factory calls and calls on imported modules. llms-full is regenerated.

The named export (for TASK-400):
- `createToastManager` is no longer exported from `@lumiose/ui` or `@lumiose/ui/toast`. It only existed to dodge this warning, and Base UI's shape is `Toast.createToastManager()`.
- toast.md, its examples and the site's toast demos use `Toast.createToastManager()`, which compiles without diagnostics.
- @lumiose/ui is unreleased, so nobody depends on the name yet. This is a proposal for the user's review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A member call on an imported module object is a factory call for LUM2001 unless its arguments read a reactive value; compiler test added; the named createToastManager export is dropped in favour of Toast.createToastManager() (proposal for TASK-400) (02e63dde). Checks: pnpm check (2295 tests), cargo fmt/clippy/test, pack:check --smoke --skip-npm, ui-e2e 519 passed (15 skipped), apps/web 159 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
