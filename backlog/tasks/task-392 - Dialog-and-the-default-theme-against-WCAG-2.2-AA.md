---
id: TASK-392
title: Dialog and the default theme against WCAG 2.2 AA
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 18:00'
updated_date: '2026-10-15 18:10'
labels:
  - ui
  - a11y
milestone: m-12
dependencies: []
references:
  - backlog/assets/task-392-dialog-light.png
  - backlog/assets/task-392-dialog-dark.png
  - backlog/assets/task-392-dialog-320-text-spacing.png
priority: high
ordinal: 391000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17). Dialog (TASK-355) and the default theme (TASK-353) shipped before the requirement. Switch the axe checks in examples/ui-e2e to the WCAG A and AA tags (as apps/web/e2e/a11y.e2e.ts does), run them closed and open with the default theme in light and dark, check the manual criteria of section 17 that apply to Dialog and the theme (contrast, non-text contrast, focus visible, target size, reflow at 320px, text spacing), and fix what fails.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 examples/ui-e2e runs axe with the WCAG A and AA tags, closed and open, light and dark, and passes
- [x] #2 The default theme meets the visual criteria of section 17, with contrast ratios recorded
- [x] #3 Dialog meets the manual criteria that apply, recorded in the task
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 Halo: claimed (branch claude/halo-m12b-eadea2).

## Audit (2026-10-15, Halo)

**Automated (AC #1).** examples/ui-e2e/e2e/a11y.ts runs axe with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` (as apps/web/e2e/a11y.e2e.ts). dialog.e2e.ts uses it for every axe call and adds "WCAG 2.2 AA with the default theme": /dialog closed, then each dialog open (alert, edit, Settings, nested Advanced), and /dialog/island closed and open, in light and dark, on `lumiose dev` and on the build. No violations and no "needs review" results, before and after the fixes below.

**Default theme, contrast (1.4.3), light / dark.** Measured from the theme's tokens (WCAG relative luminance):

| Pair | Light | Dark |
|---|---|---|
| foreground on background | 19.90 | 19.06 |
| popover-foreground on popover (dialog text) | 19.90 | 16.97 |
| muted-foreground on popover (dialog description) | 4.83 → **5.61** | 6.91 |
| muted-foreground on muted | **4.40 (fail)** → 5.10 | 5.81 |
| primary-foreground on primary (button) | 5.17 (6.10 hovered) | 5.17 |
| destructive-foreground on destructive | 4.83 | 4.83 |
| accent-foreground on accent (hovered button) | 16.12 | 14.27 |

**Non-text contrast (1.4.11).**

| Pair | Light | Dark |
|---|---|---|
| input (field and control borders) on background | **1.48 (fail)** → 3.66 | **2.57 (fail)** → 4.12 |
| input on popover (a field in a dialog) | 1.48 → 3.66 | **2.29 (fail)** → 3.67 |
| input on muted | 1.36 → 3.33 | 2.02 → 3.08 |
| ring on background | 5.17 | 7.83 |
| ring on popover | 5.17 | 6.97 |

`--lu-border` (1.27 / 1.91) stays for decoration (the dialog's edge), which 1.4.11 does not cover; the theme's header comment and the UI docs say it is not enough to outline a control.

**Fixes.** `--lu-muted-foreground` light #71717a → #67676f (it failed on `--lu-muted`, which Tabs and Menu will use); `--lu-input` #d4d4d8 / #52525b → #85858e / #71717a. Disabled buttons (opacity 0.5) are inactive components, exempt from 1.4.3 and 1.4.11.

**Theme, other visual criteria (AC #2).**
- 2.4.7 Focus Visible: `.lu-button:focus-visible` has a 2px solid ring with a 2px offset, so it sits on the surrounding surface (ratios above); e2e checks it on a trigger and inside a dialog. The dialog itself takes focus only when opened by touch, where no ring is expected; the fixture's field has its own ring.
- 2.5.8 Target Size: `.lu-button` is at least 2.25rem (36px) tall; e2e measures every button and link on /dialog and in each dialog (≥ 24×24).
- 1.4.4, 1.4.10, 1.4.12: `.lu-dialog` is `min(32rem, 100vw - 2rem)` wide and `100dvh - 2rem` tall at most (it scrolls), the footer wraps, no fixed heights. e2e at 320×640 with the WCAG text-spacing overrides: each dialog inside the viewport, no horizontal scroll, nothing clipped, every button visible. 200% zoom of a 1280px window is the 640px case, covered by the same rules.
- 1.4.1 Use of Color: the destructive and primary variants only reinforce the button's text.

**Dialog, manual criteria (AC #3).**
- 2.1.1 / 2.1.2: Enter and Space open, Tab cycles inside, Escape closes, alert dialogs included; the modal keeps focus by design (e2e "keyboard contract").
- 2.4.3: focus moves into the dialog on open and back to the trigger (or another trigger, or the opener) on close (e2e).
- 2.4.11: the dialog is in the top layer and the page behind is inert; at 320px a tall dialog scrolls, so a focused element is scrolled into view, not hidden.
- 2.5.3: the triggers' and buttons' names are their visible text; the dialog's name is its Title.
- 4.1.2: `dialog` / `alertdialog`, modal (exposed as aria-modal by the native `showModal`), named and described by Title and Description, trigger with `aria-haspopup=dialog` and `aria-expanded` (live in islands; "false" in server HTML, where the trigger is inert while the dialog is open).
- 3.2.1 / 3.2.2: nothing opens or submits on focus or input.
- 1.4.13, 2.5.1, 2.5.7, 4.1.3, 3.3.x: do not apply (no hover content, gestures, status messages or form errors in Dialog).

Screenshots: backlog/assets/task-392-dialog-light.png, task-392-dialog-dark.png, task-392-dialog-320-text-spacing.png (320px, text spacing, keyboard focus on Cancel).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
axe in examples/ui-e2e now runs the WCAG 2.0–2.2 A and AA rules (shared helper e2e/a11y.ts), closed and open, light and dark, plus e2e checks for focus visible, target size, reflow at 320px and text spacing. The default theme failed 1.4.11 on --lu-input (control borders, 1.5:1 light, 2.3–2.6:1 dark) and 1.4.3 on muted text over --lu-muted (4.4:1); both fixed (#85858e / #71717a, #67676f), ratios recorded in the notes and the theme's header. Dialog meets every manual criterion that applies. Docs: UI README (WCAG section, theme ratios).
<!-- SECTION:FINAL_SUMMARY:END -->
