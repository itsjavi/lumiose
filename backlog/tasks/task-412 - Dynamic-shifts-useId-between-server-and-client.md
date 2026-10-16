---
id: TASK-412
title: Dynamic shifts useId between server and client
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 01:09'
updated_date: '2026-10-16 01:52'
labels: []
milestone: m-12
dependencies: []
priority: high
ordinal: 411000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon in TASK-380 (2026-10-16). `useId()` in a component rendered inside `<Dynamic component="nav">` gets one id on the server and another on the client, and hydrating the island rewrites the DOM's ids. Ids that the server HTML wires together (`for`, `aria-*`, `popovertarget`, anchor names) change under the user, and anything that read them before hydration goes stale.

Repro, with packages/lumiose/src/dom/id.test.ts's `load`, `serve` and `hydrateAll`:

```tsx
import { Dynamic, useId } from "lumiose";
function Item() { const id = useId(); return <b id={id}>x</b>; }
export function Repro() { return <section><Dynamic component="nav"><Item /></Dynamic></section>; }
// server ids ["l0-0-0-0-0"], client ids ["l0-0-1-0"]; after hydration the <b> has id="l0-0-1-0"
```

The server seems to count a component level for `Dynamic` that the client does not, or the reverse. @lumiose/ui's NavigationMenu worked around it by rendering `<nav role="none">` instead of switching tags with `Dynamic`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 useId() under Dynamic returns the same id on the server and on the client, and hydration keeps the server's ids
- [x] #2 A hydration test covers Dynamic with an intrinsic tag and with a component
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Spark (runtime), in M12 where it was found. Navigation Menu works around it by not using Dynamic.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).

2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55, batch 8): fixed in dda1e5ee.

Cause:
- The client `Dynamic` (packages/lumiose/src/dom/public.ts) returns a function that the parent's `insert` calls later, from the parent's frame.
- The content it creates (an element's children, or a component) therefore got the parent's next instance path (`0.1`), while the server renders it inside Dynamic's own frame (`0.0.0`).
- So `useId()` differed, and so would await replay keys.

Fix: Dynamic keeps the frame current at its creation (only while an island hydrates, `frame` set) and runs its first render inside it. Later re-renders, after hydration, run without a frame as before.

Tests: id.test.ts "useId under Dynamic (TASK-412)" covers an intrinsic tag and a component, plus a sibling outside. The client ids equal the server's, and the DOM's id attributes are unchanged after hydration. It fails without the fix.

Size: +0.04 kB brotli on "every export". The hard caps are OK, and the two OVER soft targets (islands, loader) were already over before.

NavigationMenu goes back to `<Dynamic component={nested ? "div" : "nav"}>`: a nested Root is a `<div>`. Its docs are updated, and its e2e passes (26) in dev and build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dynamic runs its first render in its own frame while hydrating, so useId() and await replay under it match the server; regression test; NavigationMenu uses Dynamic again (dda1e5ee).
<!-- SECTION:FINAL_SUMMARY:END -->
