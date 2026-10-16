---
id: TASK-458
title: >-
  Parent checkbox: tri-state restore, disabled children, one count,
  aria-controls
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 13:20'
updated_date: '2026-10-16 21:31'
labels:
  - ui
  - a11y
milestone: m-12
dependencies: []
priority: low
ordinal: 456000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-446 L12 (Prism). A Checkbox Group's parent checkbox (`parent`): (1) no tri-state restore: Base UI's parent cycles mixed, all, none and back to the user's partial selection; ours forgets it; (2) disabled children are ignored when the parent toggles, but should keep their state and count as Base UI does; (3) the server (checkbox.tsx parentState, every allValues entry) and the script (checkbox.script.ts children(), enabled boxes only) count differently, so the parent can render one state and then change once the script runs; (4) the parent has no `aria-controls` naming the children.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The parent restores the user's partial selection after all and none, as Base UI's
- [x] #2 Disabled children keep their state, and the server and the script count the same boxes
- [x] #3 The parent has aria-controls with its children's ids, with tests in every engine
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.

2026-10-16 (Halo): claimed (final M12 batch; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): done, after Base UI's useCheckboxGroupParent.
- Count: checkbox.script.ts's children() now include disabled boxes, as the server's parentState (allValues) does, so the parent's state no longer changes when the script runs or after a toggle (a group with a disabled unchecked box stays mixed when every enabled box is checked).
- Cycle: a child toggle records the user's selection per group; a parent toggle goes from a partial selection to all (enabled ones, plus disabled checked), to none (disabled checked stay), and back to that selection; with no partial selection it toggles all/none. Disabled boxes never change. A form reset forgets the selection.
- aria-controls: CheckboxGroup has an id (useId); a checkbox in a group gets id <group>-<value> unless it has its own; the parent's aria-controls lists allValues' ids in server HTML, and the script rewrites it from the DOM (ids of their own included) on start.
- Fixture /form/parent (four extras, napkins disabled and checked, candles disabled and unchecked). e2e: the cycle and one count, and aria-controls with and without JavaScript; all fail on HEAD sources in dev, build, Firefox and WebKit. checkbox.test.tsx and field.test.tsx updated for the new ids. Docs: checkbox-group.md; the shared checkbox script is 1.0 kB brotli now (checkbox, checkbox-group, radio-group, switch pages).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The parent checkbox follows Base UI: it counts every box as the server does, restores the user's partial selection after all and none, keeps disabled boxes as they are, and names its boxes with aria-controls. Tests in every engine.
<!-- SECTION:FINAL_SUMMARY:END -->
