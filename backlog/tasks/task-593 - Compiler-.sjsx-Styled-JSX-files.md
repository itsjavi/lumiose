---
id: TASK-593
title: 'Compiler: .sjsx (Styled JSX) files'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 04:12'
labels:
  - sjsx
  - compiler
milestone: m-15
dependencies: []
priority: medium
ordinal: 585000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-88: `.sjsx` (Styled JSX) is JSX plus raw-CSS `<style>` blocks, parsed as JavaScript, with the styles of `.stsx`. This is the compiler part, which every other M15 task builds on.

- **File kind.** `FileKind::from_path` (crates/lumiose_compiler/src/scanner/mod.rs) classifies `.sjsx` as a styled file. The source type is JSX in compile.rs `source_type` and prepare/constants.rs.
- **Output.** `compile()` (client and server targets) and `compileTsx()` accept it. compileTsx emits JSX for `.sjsx`, so @lumiose/stsx can serve `X.sjsx.jsx`; its result says which.
- **Everything that names `.stsx`** handles `.sjsx` too: module ids (module_id.rs), dev source locations (dev_source.rs), the masking scan (`scan().masked`, valid JavaScript for `.sjsx`), diagnostics, and island refs.
- **Hosts.** The napi and wasm entry points accept it (crates/lumiose_napi, crates/lumiose_wasm). The compiler's TypeScript declarations and docs comments say so.
- **TypeScript syntax in `.sjsx`** (type annotations, `as`, generics) is a parse error with a code frame, as it would be in a `.jsx` file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 compile() and compileTsx() accept .sjsx, parsed as JavaScript, with the styles, diagnostics and source maps of .stsx
- [ ] #2 Scanner, golden and napi tests cover .sjsx; TypeScript syntax in .sjsx is a parse error with a code frame
<!-- AC:END -->
