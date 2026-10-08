---
id: TASK-83
title: >-
  lumen_css: keyframes and LUM3005 labels for nested style subtrees
  (decision-23)
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-08 20:49'
labels:
  - css
  - compiler
milestone: m-1
dependencies:
  - TASK-79
priority: medium
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-79 scopes a nested <style> to its enclosing element's subtree: the compiler passes each style-bearing element's blocks as Scope::Component { name, token } with a token of its own (the first element of a component keeps scope_token(path, name); later ones scope_token(path, "name#k")). Two lumen_css behaviours need the subtree chain, which Scope does not carry:
1. Keyframes: a block sees its own token's @keyframes and the file's. Before decision-23 every block of a component shared one token, so @keyframes spin in the root block and animation: spin in a nested block resolved; now the nested reference is left unrenamed (silently unanimated). Elements of a nested subtree carry every enclosing subtree token, so the nested block should also see the keyframes of its enclosing subtrees (innermost wins).
2. LUM3005 label: "matches no element in component `Tree`" is misleading for a nested block whose inventory is only its subtree (the class may exist elsewhere in Tree).
Proposed API (the compiler then passes it; Photon wires it): Scope::Component gains outer: Vec<String> (tokens of the enclosing subtrees in the same component, outermost first) and subtree: Option<String> (the enclosing element's tag; None for the component's first/root subtree) for the label, e.g. "the `<p>` subtree of component `Tree`".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Keyframes defined in an enclosing subtree's block (same component) are visible to nested blocks; own > innermost enclosing > ... > file
- [ ] #2 LUM3005 for a nested subtree block names the subtree (e.g. the <p> subtree of component Tree)
- [ ] #3 Compiler passes outer/subtree (Photon) and the nested-styles golden covers a shared @keyframes
<!-- AC:END -->
