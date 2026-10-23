---
id: TASK-538
title: 'ui: a controlled ToggleGroup cannot keep a toggle pressed'
status: Done
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 21:57'
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
- [x] #1 When onValueChange does not change a controlled value, the toggles show that value again (as Base UI's controlled ToggleGroup does)
- [x] #2 Switching between toggles still works, controlled and uncontrolled; tests cover both
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo, on branch worktree-agent-a15ab82b58aa2393f (commit 884d1791, not merged yet). Cause: the group's element flips aria-pressed itself, and a controlled value that onValueChange leaves unchanged was never applied again (the value effect does not rerun). Fix: after onValueChange, a controlled group (value set) writes value back to the toggles and the element, as Base UI's controlled ToggleGroup does; a value the callback changed equals the element's, so that write does nothing. Switching still works: pressing B fires the cancelable pressedchange release for A, and a callback that takes B updates value. Tests (toggle-group.dom.test.tsx, fail without the fix): a callback that ignores the empty release keeps A pressed and switching to B works; a callback that ignores a press undoes it; an uncontrolled group switches and reports each value. Docs: toggle-group.md (value row, a paragraph on controlled groups).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A controlled ToggleGroup shows its value again after onValueChange, as Base UI's does; switching works controlled and uncontrolled. Unit tests cover both; ui-e2e green in Chromium, Firefox and WebKit.
<!-- SECTION:FINAL_SUMMARY:END -->
