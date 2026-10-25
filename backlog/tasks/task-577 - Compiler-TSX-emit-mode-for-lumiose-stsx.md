---
id: TASK-577
title: Compiler TSX emit mode for @lumiose/stsx
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
labels:
  - compiler
  - stsx
milestone: m-14
dependencies:
  - TASK-572
  - TASK-573
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
  - crates/lumiose_compiler/src/compile.rs
  - crates/lumiose_napi/src/lib.rs
priority: high
ordinal: 569000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-86's compiler mode: a napi entry (or compile target) that returns TSX for other JSX frameworks. It replaces the spike's compile() + scan() + oxc-parser triple parse with a single parse.
- **Emitted TSX.** `<style>` blocks and `$ref` artifacts removed. Scope markers per `scopedStyles` on intrinsic elements: attributes, or classes merged into the `classAttribute` value (static strings, or a wrapped dynamic expression).
- **Passthrough.** With the class strategy, the parent's scope classes are appended to the `classAttribute` prop it passes to components.
- **Outputs.** The CSS and its map, a source map from the TSX to the .stsx source, and cssDeps/moduleRequests as today.
- **Diagnostics.** Scanner and LUM3xxx only. The LUM3005 inventory reads `classAttribute` (`className` or `class`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The napi binding returns TSX, CSS, both source maps, cssDeps, moduleRequests and style-only diagnostics for a .stsx source, parsing it once
- [ ] #2 Scope markers follow scopedStyles under both strategies, on intrinsic elements only, and match the selectors lumiose_css emits for the file's scopes
- [ ] #3 With strategy class, static and dynamic classAttribute values merge the scope classes, and a parent's scope classes are appended to the classAttribute it passes to a component
- [ ] #4 LUM3005 reads classAttribute (className or class), and no LUM2xxx or LUM4xxx diagnostics are reported
- [ ] #5 The TSX source map resolves every emitted segment to the .stsx source; cargo and package tests cover React-style and Solid-style inputs
<!-- AC:END -->
