---
id: TASK-88
title: 'Pass Scope::Subtree from the compiler for nested style blocks (TASK-83 AC #3)'
status: Done
assignee:
  - Photon
created_date: '2026-10-08 20:59'
updated_date: '2026-10-08 22:11'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen_css now has Scope::Subtree { name, token, outer: Vec<String>, element: String } (TASK-83, Halo): a nested block sees the @keyframes of its enclosing subtrees (own > innermost enclosing > ... > file) and LUM3005 says 'matches no element in the `<p>` subtree of component `Tree`'. It is a new variant instead of new fields on Scope::Component, so lumen_compiler kept compiling. In crates/lumen_compiler/src/css.rs (ScopePlan::new / assign_subtree_tokens): keep Scope::Component for blocks whose enclosing element is the component's root element; use Scope::Subtree for blocks under any other element, with token as assigned today, outer = tokens of the enclosing style-bearing elements of the same component (outermost first; include the root's token when the root has a style block), element = the enclosing tag name ("" for a fragment). Also update the 'if let Scope::Component { token, .. }' token assignment to cover Subtree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Nested blocks reach lumen_css as Scope::Subtree with outer/element; root-level blocks stay Scope::Component
- [x] #2 nested-styles golden covers an @keyframes defined in an enclosing subtree and used in a nested one (renamed with the enclosing token), and a subtree LUM3005 label
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
css.rs: ElementSpans records each style-bearing element's tag and whether it is a root of the JSX (JSX depth 0). assign_subtree_tokens keeps Scope::Component for root elements and builds Scope::Subtree { name, token, outer, element } for the others: outer = tokens of the same component's style-bearing elements whose span contains the element, outermost first (the sorted element list), element = tag ("" for fragments). Golden: nested-styles.stsx gains @keyframes fade/pulse in the root block and a nested block using both (fade resolves to the root's token, pulse to the block's own); its .c1 LUM3005 now names the <p> subtree. Docs: styles.md (keyframes visibility), errors/LUM3005.md (subtree scope).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon: done. Evidence: crates/lumen_compiler/tests/fixtures/client/nested-styles.css has '.c2[data-l-44pntcw3] { animation: 1s fade-wepye2d9, 2s pulse-44pntcw3 }' (fade from the enclosing root block wepye2d9, the nested block's own pulse wins over the root's pulse-wepye2d9); nested-styles.js diagnostics: 'LUM3005 warning 20:45 `.c1` matches no element in the `<p>` subtree of component `Tree`'. Root-level blocks (Tree's <section>, Rows' fragment) stay Scope::Component (their labels and tokens unchanged in the other goldens). cargo test/clippy/fmt -p lumen_compiler green; pnpm test 1014/1014; pnpm build:compiler.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The compiler now passes Scope::Subtree to lumen_css for style blocks nested under non-root elements, with the enclosing style-bearing tokens (outermost first) and the element's tag; blocks under a root element stay Scope::Component. Nested blocks see the @keyframes of enclosing blocks, and LUM3005 names the subtree. Golden nested-styles covers both; styles.md and LUM3005.md updated.
<!-- SECTION:FINAL_SUMMARY:END -->
