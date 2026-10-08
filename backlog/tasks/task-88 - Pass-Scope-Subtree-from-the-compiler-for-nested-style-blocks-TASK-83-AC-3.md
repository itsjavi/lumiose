---
id: TASK-88
title: 'Pass Scope::Subtree from the compiler for nested style blocks (TASK-83 AC #3)'
status: To Do
assignee:
  - Photon
created_date: '2026-10-08 20:59'
labels: []
milestone: m-1
dependencies:
  - TASK-83
priority: medium
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen_css now has Scope::Subtree { name, token, outer: Vec<String>, element: String } (TASK-83, Halo): a nested block sees the @keyframes of its enclosing subtrees (own > innermost enclosing > ... > file) and LUM3005 says 'matches no element in the `<p>` subtree of component `Tree`'. It is a new variant instead of new fields on Scope::Component, so lumen_compiler kept compiling. In crates/lumen_compiler/src/css.rs (ScopePlan::new / assign_subtree_tokens): keep Scope::Component for blocks whose enclosing element is the component's root element; use Scope::Subtree for blocks under any other element, with token as assigned today, outer = tokens of the enclosing style-bearing elements of the same component (outermost first; include the root's token when the root has a style block), element = the enclosing tag name ("" for a fragment). Also update the 'if let Scope::Component { token, .. }' token assignment to cover Subtree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Nested blocks reach lumen_css as Scope::Subtree with outer/element; root-level blocks stay Scope::Component
- [ ] #2 nested-styles golden covers an @keyframes defined in an enclosing subtree and used in a nested one (renamed with the enclosing token), and a subtree LUM3005 label
<!-- AC:END -->
