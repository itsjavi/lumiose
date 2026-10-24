---
id: TASK-556
title: >-
  Execution-contract hovers show a keyed row's item reads and the list index as
  tracked
status: To Do
assignee: []
created_date: '2026-10-24 08:40'
labels:
  - compiler
  - dx
dependencies: []
priority: low
ordinal: 548000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found during TASK-554. The execution contract (crates/lumiose_compiler/src/codegen/client/contract.rs, CompileOptions::contract, shown in language-server hovers) classifies JSX expressions syntactically: a plain identifier is 'once'. In a .map() row, the list index (i, compiled to i()) and, since decision-83, a keyed row's item and its destructured bindings (compiled to item() / _item().path) are tracked, so hovers over {i}, {item} or {name} in such rows say 'once'. The collector would need the row key analysis of codegen/client/rows.rs to tell keyed rows apart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hovers over the index and over a keyed row's item reads (plain and destructured) report them as tracked; unkeyed rows' items stay once
<!-- AC:END -->
