---
id: TASK-75
title: Diagnose class passthrough lost through a helper
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 16:37'
updated_date: '2026-10-08 21:27'
labels: []
milestone: m-5
dependencies: []
priority: low
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building @lumen/site-kit (TASK-59). Class passthrough (applyScope with props.$$scope) is emitted only when props.class appears syntactically in an element's class expression. Moving the class value into a helper, e.g. class={variantClass(props)} where the helper returns ['btn', {…}, props.class], compiles to bind(el, () => variantClass(props), setClass) without applyScope: the parent's classes arrive but its scoped selectors silently stop matching. The kit inlines the class arrays to avoid it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Either passthrough also applies when a component passes props (or props.class) into a helper used as the class value of an element, or the compiler warns with a fix (inline props.class in the class expression)
- [x] #2 Documented in concepts/styles (class passthrough) via a Beacon note if user-facing
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Diagnose: element.rs reads_props_class only matched a syntactic props.class in the visited class expression. Fix (AC#1 option 1) instead of a warning: a class flow analysis (class_flow.rs) shared by client and server codegen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-08), commit 5c228df. Diagnosis: ClassReadFinder matched only `<props>.class` inside the element's class expression, so class={variantClass(props)}, closures, aliases and `...rest` lost applyScope / the SSR scope attributes. Fix: codegen/client/class_flow.rs. An element's class value may carry the class prop when it reads props.class or props[non-literal or 'class'], uses `props` as a value (helper argument, spread), reads a destructured class prop or the rest binding of a destructured props parameter (unless class is destructured on its own), or reads a component binding that carries it; carriers are computed per component from its untransformed body (variable declarators, function declarations, identifier assignments) to a fixpoint. Conservative by design: applying the scope to an element without the passed class only lets the parent's selectors match it if they match its classes anyway. Not needed: a warning; the only remaining gaps are flows outside the component (module-level variables, context), documented. Known unrelated gap noticed: forwarding props.class to a child component (<Inner class={props.class} />) passes the current component's tokens as $$scope, not the grandparent's, so a grandparent's selectors do not reach Inner's element (not in this task's scope). Tests: golden fixture class-passthrough.tsx (Helper, Closure with closure+alias+function, Destructured, Rest, Computed key: applyScope / spreadAttrs({ $$scope }) emitted; Other: not emitted); no other golden changed. Docs: concepts/styles.md class passthrough bullet (written by Photon, AC#2), llms regenerated. Validation: cargo test -p lumen_compiler, clippy 0 warnings, fmt; pnpm build:compiler; pnpm test 946 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Class passthrough now follows props.class through helpers that receive props, component-local closures/aliases/functions, destructured class props and ...rest (client applyScope and server scope attributes), so site-kit-style variantClass(props) helpers keep the parent's scoped selectors. Golden fixture and styles docs.
<!-- SECTION:FINAL_SUMMARY:END -->
