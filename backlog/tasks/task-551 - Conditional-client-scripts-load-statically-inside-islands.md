---
id: TASK-551
title: Conditional ?client scripts load statically inside islands
status: To Do
assignee:
  - Photon
created_date: '2026-10-23 22:45'
labels:
  - vite
  - ui
  - performance
dependencies: []
priority: low
ordinal: 543000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui 0.1.2 pass (2026-10-24), also noted by Halo in TASK-541. An island (client:load) that renders `<Popover.Root><Popover.Trigger>Open</Popover.Trigger><Popover.Popup>…</Popover.Popup></Popover.Root>` without openOnHover still loads popover-hover.script and the shared hover chunk (about 1 kB brotli): in client bundles, a component's `?client` import becomes a static side-effect import, so a guard like `if (openOnHover) popoverHoverScript()` has no effect there. The same Popover in server HTML loads neither. Other conditional `?client` scripts that island components import probably behave the same.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inside islands, a ?client script that a component calls only conditionally is loaded only when called (or the docs explain why not and ui avoids the pattern)
- [ ] #2 A build test with an island that renders a Popover without openOnHover shows no hover chunk
<!-- AC:END -->
