---
id: TASK-391
title: LUM2001 warning in Dialog.Popup's server-only content
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 17:52'
updated_date: '2026-10-15 20:42'
labels:
  - ui
  - diagnostics
milestone: m-12
dependencies: []
priority: low
ordinal: 390000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen in the local showcase (2026-10-15): every dev compile of packages/ui/src/dialog/dialog.tsx warns LUM2001 at `const content = isServer ? children : undefined;` (Dialog.Popup), in the server and client environments. Either restructure the code so the intent (server renders the children, the browser claims the dialog first) needs no warning, or, if the warning is a false positive for isServer-guarded values, record that and route a compiler fix to Photon.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Compiling dialog.tsx reports no LUM2001, in dev and build
- [x] #2 Dialog's hydration and doc-9 checks still pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Spark, TASK-357): Menu's GroupElement (packages/ui/src/menu/menu.tsx) uses the same `const content = isServer ? children : undefined` pattern, so the server writes a group's aria-labelledby only when its GroupLabel rendered; it warns LUM2001 the same way. The fix for Dialog should cover both.

2026-10-15 (Lux): Menu.Popup (packages/ui/src/menu/menu.tsx, const content = isServer ? children : undefined) warns LUM2001 the same way; Popover avoids it with untrack(() => children). Fix both alike.

2026-10-15 (Halo): claimed (M12 third batch, branch claude/halo-m12c-4d6b9f).

2026-10-15 (Halo): fixed as Popover does: `const content = isServer ? untrack(() => children) : undefined;` in Dialog.Popup and Menu's GroupElement (the group of Menu.Group and Menu.RadioGroup; Menu.Popup itself has no such read). Not routed to the compiler: the warning is right in principle (a prop read in setup is stale in islands); the `isServer` guard makes it intended on the server, and `untrack` states that intent. A compiler refinement that treats `isServer ? x : …` branches as server-only would only save the `untrack` call; not proposed. Regression guard: packages/ui/src/compile.test.ts compiles every component for the server and the client and expects no diagnostic (14 cases, green). Evidence: the ui-e2e dev and build servers print no LUM2001 any more; Dialog, Menu and Combobox e2e 133 passed, 3 skipped by design (dev and build), Dialog and Menu unit tests green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dialog.Popup and Menu's group read their children once on the server through untrack(), as Popover does, so no component warns LUM2001; a unit test compiles every @lumiose/ui component for both targets with no diagnostics.
<!-- SECTION:FINAL_SUMMARY:END -->
