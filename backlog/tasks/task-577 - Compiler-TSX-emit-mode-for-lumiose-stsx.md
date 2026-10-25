---
id: TASK-577
title: Compiler TSX emit mode for @lumiose/stsx
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 01:07'
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
- [x] #1 The napi binding returns TSX, CSS, both source maps, cssDeps, moduleRequests and style-only diagnostics for a .stsx source, parsing it once
- [x] #2 Scope markers follow scopedStyles under both strategies, on intrinsic elements only, and match the selectors lumiose_css emits for the file's scopes
- [x] #3 With strategy class, static and dynamic classAttribute values merge the scope classes, and a parent's scope classes are appended to the classAttribute it passes to a component
- [x] #4 LUM3005 reads classAttribute (className or class), and no LUM2xxx or LUM4xxx diagnostics are reported
- [x] #5 The TSX source map resolves every emitted segment to the .stsx source; cargo and package tests cover React-style and Solid-style inputs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Photon's task at the user's request (M14 run).

2026-10-25 (Lux): lumiose_compiler::compile_tsx (src/tsx.rs) and the napi compileTsx(source, filename, { classAttribute, scopedStyles?, styleImport?, sourceMap?, cssTargets?, cssMinify?, root?, packages?, modules? }) return { code, map, css, cssMap, cssDeps, moduleRequests, diagnostics, scopeTokens }.
- One parse of the masked TSX: the same scan, style refs, analysis (components) and ScopePlan as compile(), no Lumiose codegen.
- The TSX is the source with edits: blocks removed (SVG blocks kept), markers per scopedStyles on intrinsic elements. Attributes go after the tag name. Classes are merged into the classAttribute: appended to a string; [value, "m"].filter(Boolean).join(" ") for a computed value; added when missing; after the spreads (reading their class) when they are plain references, else before them. Class passthrough appends the caller's scope classes to the classAttribute passed to components (class strategy only). The style import goes after directives ("use client").
- Source map: copied text maps to itself at line and word starts (UTF-16 columns), sources = [filename] with its content.
- Diagnostics: scanner, syntax, LUM3xxx (analysis LUM2/LUM4 and type-strip ones dropped). The inventory reads classAttribute (className or class) and treats Solid's classList as dynamic.
- oxc_sourcemap moved from the compiler's dev-dependencies to its dependencies (already a pinned workspace dependency).
- Tests: tsx_golden (react-attributes, react-classes, solid-zero, plus a source-map lookup test) and packages/compiler/test/compile-tsx.test.ts (React and Solid styles, UTF-16 spans, invalid namespace). README mentions compileTsx. cargo test --workspace, clippy and the compiler package tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
compileTsx compiles a .stsx file to TSX for another JSX framework in one parse: blocks removed, scope markers per scopedStyles (attributes, or classes merged into className/class, with class passthrough), CSS with an inventory that reads the class attribute, style-only diagnostics and a source map to the .stsx source. Covered by Rust goldens for React and Solid and by napi tests.
<!-- SECTION:FINAL_SUMMARY:END -->
