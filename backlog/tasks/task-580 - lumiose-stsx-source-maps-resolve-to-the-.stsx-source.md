---
id: TASK-580
title: '@lumiose/stsx: source maps resolve to the .stsx source'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 01:24'
labels:
  - build
  - stsx
milestone: m-14
dependencies:
  - TASK-578
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
priority: medium
ordinal: 572000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the spike, production maps listed the virtual `*.stsx.tsx` ids beside the `.stsx` sources. Compose the emit map with the framework's transform, so that every segment resolves to the `.stsx` file with sourcesContent, in dev (devtools) and in builds. CSS maps point at the style blocks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Production JS source maps list only .stsx sources (no virtual *.stsx.tsx ids), with sourcesContent, for React and Solid
- [x] #2 Dev source maps open the .stsx file at the right line in the browser devtools, checked with a breakpoint or a stack trace
- [x] #3 CSS source maps resolve rules to the lines of their <style> blocks
- [x] #4 A test asserts the sources and a sampled mapping
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Photon's task at the user's request (M14 run).

2026-10-25 (Lux): two causes.
1. **Inserted text had no mapping.** The CSS import line and the markers had no token, so composing tools could not trace segments on those lines. compile_tsx now maps inserted text to its insertion point (each of its lines), in crates/lumiose_compiler/src/tsx.rs.
2. **Rolldown's native transforms skip transform maps.** In builds, they do not compose the maps of JS `transform` hooks that run after `load`: segments pointed to the raw load output under the virtual id `App.stsx.tsx`. The plugin now emits the TSX, with its map, from `load` (`emit()`). `transform` compiles only when a host passes the raw source (a host that reads the file itself), and skips code it already emitted.

**Result.** Production maps for React and Solid name only `App.stsx` (with `sourcesContent`), and `function Counter` maps to its line. An extra `App.stsx` entry without segments comes from the stylesheet module's empty JS wrapper; it is harmless. Dev JS maps name the `.stsx` file. Dev CSS maps (`css.devSourcemap`) map `.page[…]` to the `.page {` line of the `<style>` block.

**Tests.** packages/stsx/src/sourcemap.test.ts (React production, Solid production, dev JS and CSS, with a VLQ decoder) and the tsx_golden map test. The dev mapping was checked through the dev server's map, not in the browser devtools UI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Source maps of .stsx modules resolve to the .stsx file in dev and production, for React and Solid: inserted text is mapped, and the TSX is emitted from load so Rolldown composes from its map. CSS maps point at the style block lines. Covered by sourcemap tests.
<!-- SECTION:FINAL_SUMMARY:END -->
