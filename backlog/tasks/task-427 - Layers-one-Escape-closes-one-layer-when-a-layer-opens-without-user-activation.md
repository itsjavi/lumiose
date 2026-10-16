---
id: TASK-427
title: 'Layers: one Escape closes one layer when a layer opens without user activation'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:22'
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
- [x] #1 Layers: one Escape closes one layer when a layer opens without user activation, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (release-review fix batch 1; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): fixed as proposed. layer.ts handles Escape on keydown in every browser (bubble phase on document, after a layer's own handlers; cancelled, so no native close request follows) and creates a CloseWatcher only while navigator.userActivation.isActive (Android back). dialog.script.ts handles Escape on window (after the layers on document): requestClose() on the topmost open modal (tracked in open order), nothing for closedby="none", and it yields to a native popup above the dialog (an open customizable select picker, or a popover no layer runs; the toast viewport aside), found when the Select-in-dialog test broke. New fixture /layers (hover popover in hover popover; hover popover and preview card in a dialog) and e2e/layers.e2e.ts: the controls are measured first, the page reloaded, then driven by mouse and keys only with no checks until after the Escapes (Playwright's checks grant activation in Chromium and hide the bug). Both tests fail without the fix in dev, build, Firefox and WebKit, and pass with it; dialog, popover, menu, combobox, preview card, drawer, select, toast and tooltip suites green in Chromium. Docs: menu.md and combobox.md CloseWatcher lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One Escape closes one layer: layers and modal dialogs handle Escape on keydown (CloseWatcher only with user activation), so watchers grouped without activation no longer close several layers. Regression tests on the new /layers fixture fail without the fix in Chromium, Firefox and WebKit.
<!-- SECTION:FINAL_SUMMARY:END -->
