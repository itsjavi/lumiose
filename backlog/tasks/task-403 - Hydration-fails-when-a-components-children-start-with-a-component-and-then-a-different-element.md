---
id: TASK-403
title: >-
  Hydration fails when a component's children start with a component and then a
  different element
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 22:29'
updated_date: '2026-10-15 22:46'
labels:
  - runtime
  - hydration
milestone: m-12
dependencies:
  - TASK-365
priority: high
ordinal: 402000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-365 (2026-10-15); the repros are in TASK-365's notes. In a client:load island, `<Wrap><B /><NS.P /></Wrap>` fails to hydrate (LUM4006) and the island renders on the client. The swapped order, two `<B />`, and a plain `<div><B /><p>x</p></div>` all hydrate. In @lumiose/ui, `Field.Control` followed by `Field.Description` hits it: the control's template never claims its server `<input>`. Same family as the fixed TASK-234. The ui-e2e form island works around it by putting the control last.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both repros hydrate without LUM4006, with a regression test
- [x] #2 The ui-e2e form island uses the natural order (control before description) again
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 5. New sessions cannot start from an automated turn, so the idle Beacon session takes it. Beacon may edit the runtime files the fix needs (packages/lumiose/src/dom/**, the compiler output tests), since no Spark session is running.

2026-10-16 (Beacon): fixed in packages/lumiose/src/dom/hot.ts (runtime, no compiler change).

Root cause: dev-only (`lumiose dev` compiles client modules with `hot`); builds were not affected. The compiled code is identical for both repros. In dev, every top-level component is wrapped by `$hot`. The wrapper returned a function, so the component's first render was deferred to the region of whoever inserted it, while a sibling that is not a registered component (`NS.P`, `Field.Description` through a namespace object) rendered at once in the children array and claimed the deferred component's server nodes. That is the claim-order family of TASK-234, through the HMR wrapper. `<B /><B />` worked because both were deferred, and the swapped order worked because the immediate sibling came first.

Fix: the wrapper's first render runs when it is called, as the component does without the wrapper (under hydration, with the frame `createComponent` gave the instance). The function it returns hands that result to the inserting region, still tracks the module version, and re-renders the instance on later versions as before (the TASK-146 hot test still passes).

Tests:
- packages/lumiose/src/dom/hydrate.test.ts "hydrate: component children that start with a component (TASK-403)": real compiler output with `hot`, the repro, no LUM4006, same HTML. It fails without the fix.
- examples/ui-e2e's form island is back in the natural order (Label, Control, Description, Error; the groups before the checkbox, switch and submit button). Its test fails on any LUM warning, in dev and build.

Validation: packages/lumiose vitest 1122 passed and tsc clean; ui-e2e form suite 33 passed (dev and build). The repro was also checked in a real dev island (LUM4006 before the fix, none after).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed: in `lumiose dev`, an island's component children that started with a component and then a different element (`<Wrap><B /><NS.P /></Wrap>`, `Field.Control` then `Field.Description`) failed to hydrate (LUM4006). The HMR wrapper deferred the component's first render, so the next sibling claimed its server nodes. The wrapper now renders the first time when called, as without HMR, and keeps re-rendering on module updates. A regression test and the ui-e2e form island in its natural order cover it.
<!-- SECTION:FINAL_SUMMARY:END -->
