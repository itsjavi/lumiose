---
id: TASK-538
title: 'ui: a controlled ToggleGroup cannot keep a toggle pressed'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 20:58'
labels:
  - ui
  - bug
dependencies: []
priority: medium
ordinal: 531000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). Repro: `const v = signal("a"); <ToggleGroup aria-label="V" value={[v()]} onValueChange={(n) => { if (n[0]) v.set(n[0]); }}><Toggle value="a">A</Toggle><Toggle value="b">B</Toggle></ToggleGroup>`. Clicking A leaves both A and B with aria-pressed=false while v() is still "a": the element releases first, and since `value` did not change nothing presses it again. Cancelling every release in `pressedchange` breaks switching, since pressing B fires a cancelable release for A. Workaround: cancel only the release that would leave no toggle pressed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When onValueChange does not change a controlled value, the toggles show that value again (as Base UI's controlled ToggleGroup does)
- [ ] #2 Switching between toggles still works, controlled and uncontrolled; tests cover both
<!-- AC:END -->
