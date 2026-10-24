---
id: TASK-553
title: >-
  Compiler keeps list keys that read destructured params, the index or nested
  arrows; a key it cannot compile warns
status: Done
assignee:
  - Spark
created_date: '2026-10-24 08:01'
updated_date: '2026-10-24 11:03'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: high
ordinal: 545000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the row re-render investigation of a port's virtual grid (2026-10-24), approved by the user as F3, the prerequisite of same-key rows updating in place. `take_key` (crates/lumiose_compiler/src/codegen/client/idioms.rs) keeps a key only when it reads the item identifier and outer bindings. A key that reads a destructured item parameter (`({ id }) => <li key={id}>`), the index parameter, a nested arrow's parameter (`row.map((p) => p.id).join("|")`) or a row const is dropped without a word, so the list falls back to reference matching and rebuilds every row whose item is a new object.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A key that reads destructured item params, the index param, nested arrows' params or plain row consts compiles to a key function that gets what it needs (item, index)
- [x] #2 A key on a row callback with several returns compiles when every keyed root agrees on it
- [x] #3 Any key the compiler still cannot compile is a warning with a code and a docs page (LUM code conventions), never a silent drop
- [x] #4 compile_api tests and codegen goldens cover the kept keys and the warning
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (standalone worker for Lux; Lux granted the compiler's list codegen for this task).

- New module crates/lumiose_compiler/src/codegen/client/rows.rs: check_row_key (both targets) finds the key attributes of a row callback's JSX outside nested functions; the key of every returned element (expression body or any return statement, not only a single return) is the row key. It compiles when it reads only the item parameter or its pattern's bindings, the index parameter, bindings it declares (nested arrows' params), plain row consts (inlined into the key function) and outer bindings. take_key (client) removes the root keys and builds (itemPattern, indexPattern?) => key; the index parameter is passed only when the key reads it, and a render callback that reads the index only in the key no longer gets an index signal.
- LUM2008 (warning, Unsupported list key): a key that reads another local of the callback, returned elements with different keys, a constant key, and a key on an element the callback does not return (inside a conditional, a fragment, a child of the row). The list then matches rows by reference, as before.
- Row consts now also come from destructured item params (RowData takes the item's bindings).
- Tests: codegen golden tests/fixtures/client/row-keys.tsx (client and server), compile_api row_keys_that_cannot_compile_warn_with_lum2008_on_both_targets.
- Docs: errors/LUM2008.md, concepts/jsx.md 'Lists and keys' (h3 inside Concept: concept pages keep their five sections), llms regenerated.
- Checks: cargo test -p lumiose_compiler, cargo test --workspace, clippy -D warnings, docs:check, vitest packages/compiler, cli, lumiose dom/docs/scripts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Keys that read the item's pattern bindings, the index, nested arrows' parameters or plain row consts compile to (item, index?) => key; a callback with several returns keeps the key its returned elements share; any other key is the LUM2008 warning (docs page errors/LUM2008.md) and the list matches rows by reference. Validated with the codegen goldens (row-keys.tsx), compile_api, cargo test --workspace, clippy, docs:check and pnpm check (run with TASK-554).
<!-- SECTION:FINAL_SUMMARY:END -->
