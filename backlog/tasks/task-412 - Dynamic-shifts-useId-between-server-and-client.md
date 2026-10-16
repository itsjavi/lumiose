---
id: TASK-412
title: Dynamic shifts useId between server and client
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-16 01:09'
updated_date: '2026-10-16 01:31'
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
- [ ] #1 useId() under Dynamic returns the same id on the server and on the client, and hydration keeps the server's ids
- [ ] #2 A hydration test covers Dynamic with an intrinsic tag and with a component
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Spark (runtime), in M12 where it was found. Navigation Menu works around it by not using Dynamic.
<!-- SECTION:NOTES:END -->
