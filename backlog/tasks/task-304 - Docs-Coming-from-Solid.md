---
id: TASK-304
title: 'Docs: Coming from Solid'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 04:39'
labels:
  - docs
milestone: m-10
dependencies:
  - TASK-301
priority: low
ordinal: 306000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A guide for Solid and SolidStart developers, following the shared outline. Solid is the closest model (setup-once components and fine-grained signals, decision-3), so the guide focuses on differences: createSignal, createMemo and createEffect → signal, computed and effect (decision-32 and decision-35); props and destructuring (compiler idioms, decision-7); control-flow components (Show, For) and their Lumiose equivalents; createResource and Suspense → async components; stores → store(); context; .stsx files and style blocks; server-first rendering with islands versus SolidStart's SSR; SolidStart file routes, server functions and actions → file routes, endpoints and form actions; Solid Router → lumiose/router.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide covers every mapping above, with type-checked examples
- [x] #2 Solid features without an equivalent are listed with the recommended alternative
- [x] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (M10 batch 1): started. Guide at packages/lumiose/docs/coming-from/solid.md on the shared outline (TASK-301).

Done: coming-from/solid.md (Solid 1.x, Solid Router, SolidStart) focuses on differences, in four tables (reactivity, components and JSX, SolidStart, Solid Router): createSignal/createMemo/createEffect -> signal/computed/effect, stores (store, reconcile, snapshot), props destructuring instead of splitProps/mergeProps, Show/For/Index/Switch as plain JSX, createResource/Suspense -> async components, context, .stsx styles, islands vs SolidStart's full hydration, file routes, API routes, server functions and actions -> endpoints and form actions, Solid Router -> lumiose/router. Type-checked examples: the todo list (components/Todos.stsx with a style block) and a SolidStart-style member page (query + form action + an island). No-equivalent list includes createRoot/getOwner, createDeferred/observable, SuspenseList, lazy, server functions, per-instance useSubmission (TASK-297) and useBeforeLeave (TASK-296), described as missing in this version with no dates. No new public names. Validation: docs:gen, docs:check, docs and site content tests green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Coming from Solid guide (docs/coming-from/solid.md) on the shared outline, with type-checked examples; listed in the docs index, site navigation and llms.txt.
<!-- SECTION:FINAL_SUMMARY:END -->
