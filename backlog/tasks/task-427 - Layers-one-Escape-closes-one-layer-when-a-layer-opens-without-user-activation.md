---
id: TASK-427
title: 'Layers: one Escape closes one layer when a layer opens without user activation'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: high
ordinal: 425000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H1.

**H1. Layers: one Escape closes two layers when a layer opens without user activation (CloseWatcher grouping).** Popover, Preview Card, Dialog. CONFIRMED in 3 engines.
- `layer.ts` creates a `CloseWatcher` per layer. A watcher created without transient activation joins the previous one's group, and one close request closes the group. Native dialog watchers group the same way.
- **Repros** (`/popover`, input only between steps):
  - Hover-open "Filters", then hover-open the nested "Date range…", then press Escape. Both close.
  - In the "Share…" dialog, hover-open the inner popover, Escape, hover it again, Escape. The dialog closes too.
  - A Preview Card in a dialog, and a nested Dialog opened by script (an `open` prop set by a timer or a fetch), do the same.
- Menu and Tooltip are safe because they cancel the Escape keydown.
- **Test-kit note:** Playwright's Chromium `evaluate`/locator queries grant user activation, which hides this. Prism's own first nesting probe passed falsely for that reason.
- **Violates:** doc-9 §1 "one Escape closes one layer"; BU DialogRoot.test "dismisses non-nested dialogs one by one".
- **Fix:**
  - layer.ts handles Escape on `keydown` in every browser (`preventDefault`, dismiss the top layer). Create a CloseWatcher only while `navigator.userActivation.isActive`, for Android back.
  - dialog.script cancels Escape on keydown and calls `requestClose()` on the topmost modal (not for `closedby="none"`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Layers: one Escape closes one layer when a layer opens without user activation, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->
