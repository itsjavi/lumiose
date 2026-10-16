---
id: TASK-348
title: Destructuring children in a component body reads them too early
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-15 12:36'
updated_date: '2026-10-16 23:19'
labels:
  - compiler
  - bug
dependencies: []
priority: medium
ordinal: 350000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike (removed in TASK-363; it remains in the git history). `const { children, ...rest } = props` in a component body reads children at setup, before the slot is ready; in an island it causes a hydration mismatch (LUM4006).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Destructuring children and rest props in a component body hydrates without LUM4006
- [x] #2 Compiler and hydration tests cover it
- [x] #3 The JSX docs describe the pattern
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-17 (branch claude/photon-bugs-2c1927). Reproduced on main: `const { children, ...rest } = props` stayed as written, so `children` was created in setup (LUM2001 also warned about it); the new hydration test failed with LUM4006.
Fix: the statement form is rewritten like a destructured parameter (decision-7). analyze/components.rs `body_props_patterns` picks top-level const/let declarators whose init is the props parameter (never reassigned), with the shapes a parameter allows and bindings never reassigned; their bindings join PropsSymbols (rest and children are sets now) and LUM2001 skips them. codegen props.rs `rewrite_body_props` turns reads into `props.x` (defaults included) and the declarator into `rest = restProps(props, keys)` or removes it. Nested reads (`= props.user`), reassigned bindings and destructuring inside nested functions stay as written (LUM2001 still warns where it did).
Tests: golden body-destructuring.tsx; goldens diagnostics (its `const { name } = props` no longer warns) and compile_api's server-route test (now uses `= props.params` to keep two stale values); hydrate.test.ts 'reads children destructured in a component body where they are inserted (TASK-348)' (LUM4006 before the fix).
Docs: concepts/components.md (props and an example), errors/LUM2001.md, coming-from/react.md; doc-2 bullet. DX change for the user's review: body destructuring of props is now reactive instead of a one-time read.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
const/let destructuring of the props parameter at the top of a component body (const { children, ...rest } = props) is rewritten like a destructured parameter: reads become props.x, rest becomes restProps, so children are created where they are inserted and an island hydrates without LUM4006. LUM2001 no longer reports such declarators; nested reads and reassigned bindings keep the old behaviour and warning. Golden and hydration tests; components, LUM2001 and coming-from React docs and doc-2 updated. DX change for the user's review.
<!-- SECTION:FINAL_SUMMARY:END -->
