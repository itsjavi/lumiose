---
id: TASK-382
title: Drawer
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-15 23:23'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-355
priority: medium
ordinal: 383000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Drawer: a dialog that slides from an edge, with swipe to dismiss, on Dialog (TASK-355).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Parts, props and events follow Base UI's anatomy within decision-62 (lu- tags, lowercase events, bind: by convention)
- [x] #2 Unstyled: the package ships only the CSS the primitive needs to work (display, positioning, CSS variables), in one low-priority layer
- [x] #3 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies, plus keyboard-contract and axe tests
- [x] #4 A docs page with a type-checked example
- [x] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [x] #6 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 5. New sessions cannot start from an automated turn, so the idle Beacon session takes it. Beacon may edit packages/ui/src/<component>/**, the component's docs page and e2e, and its lines in the shared package files.

2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55): implemented.

Design (orchestrator-delegated):
- Built on Dialog.
  - Drawer.Root wraps Dialog.Root (open, onOpenChange, bind:open) and holds `swipeDirection` (default "down").
  - Drawer.Popup is Dialog.Popup plus `data-swipe-direction`.
  - Trigger, Title, Description and Close are Dialog's parts; Content is a `<div>`.
  - So it is a native modal `<dialog>` opened by an invoker command: it works without JavaScript, traps focus, makes the page inert, and closes on Escape and a click outside (`closedby="any"`).
- drawer.css (lu.core, imports dialog.css for the scroll lock) puts each `dialog[data-swipe-direction]` against its edge, across that edge's length:
  - the inline or block size is `auto`, over the browser's `fit-content`;
  - margin 0, no max sizes;
  - no text selection while swiping.
- drawer.script.ts (≈1.0 kB; 1.9 kB brotli with Dialog's script):
  - Input: pointer events for the mouse and pen. On touch screens, touch events with a non-passive `touchmove` that calls `preventDefault` only once the drag is a swipe, so scrolling keeps working.
  - While a swipe runs: `data-swiping`, `--drawer-swipe-movement-x`/`-y` and `--drawer-swipe-progress` (Base UI's names). It moves at 1/8 speed against the dismiss direction.
  - Released past 40% of the drawer's size, or flicked (over 0.5px/ms across 20px), it closes with `data-swipe-dismiss`. Otherwise it springs back.
  - A swipe never starts on a control or `[data-swipe-ignore]`, nor while the content under it can still scroll the other way: the content scrolls first.
- The default theme's `.lu-drawer`:
  - a surface against its edge, with a decorative handle on bottom sheets;
  - it slides in and out (`overlay` allow-discrete), follows the swipe, and leaves from where the swipe let go;
  - the backdrop fades with `--drawer-swipe-progress`.

Left out, against Base UI's Drawer:
- Snap points: `snapPoints`, `snapPoint`, `defaultSnapPoint`, `onSnapPointChange`, `snapToSequentialPoints`. Base UI offers them as an option, so a drawer works without them. Recorded as a follow-up candidate.
- Drawer.SwipeArea (opening by swiping from the edge).
- Drawer.Provider, Indent and IndentBackground.
- VirtualKeyboardProvider.
- `createHandle` and detached triggers.
- `modal={false}` and `"trap-focus"`.
- `disablePointerDismissal`: `closedby="closerequest"` on Popup does it.
- `initialFocus` and `finalFocus`: the `autofocus` attribute and Dialog's focus return do it.
- `onOpenChangeComplete`, `actionsRef`, `defaultOpen`.
- Portal, Backdrop and Viewport: the top layer and `::backdrop` replace them (decision-62).
- The variables `--drawer-height`, `--drawer-frontmost-height`, `--drawer-snap-point-offset`, `--drawer-swipe-strength`, and `data-open`, `data-closed`, `data-expanded`, `data-nested-drawer-*`. Dialog's script gives `data-nested-dialog-open` and `--nested-dialogs`.

doc-9:
- §2 (Dialog) comes with Dialog; its e2e covers it.
- The swipe:
  - [x] direction and threshold;
  - [x] axis lock (the first move along the other axis or the other way is not a swipe);
  - [x] not on controls;
  - [x] it springs back when it falls short;
  - [x] `preventDefault` on `touchmove` only while a swipe runs;
  - [x] focus returns to the trigger after a swipe (e2e).
- Not run here: real touch hardware. Synthetic touch events cover it in the e2e.

WCAG 2.2 AA:
- Automated (ui-e2e, dev and build):
  - axe A/AA closed and open, light and dark. It caught the scrollable Content that could not be focused: the fixture and the docs now give such content `tabindex={0}` with `role="region"` and a name.
  - Focus ring; targets; reflow at 320px with text spacing (side drawer).
- 2.5.7: the close buttons, Escape and a click on the backdrop close it without the gesture. The docs ask for a visible close button.

Public names (proposals, TASK-400):
- Export `Drawer` (Root, Trigger, Popup, Content, Title, Description, Close).
- Root prop `swipeDirection`; type `DrawerSwipeDirection`; types `Drawer{Root,Trigger,Popup,Content,Title,Description,Close}Props`.
- Entries `@lumiose/ui/drawer` and `/drawer.css`.
- Attributes `data-swipe-direction`, `data-swiping`, `data-swipe-dismiss`, and the opt-out `data-swipe-ignore`.
- Variables `--drawer-swipe-movement-x`/`-y` and `--drawer-swipe-progress`.
- Theme class `lu-drawer`.

Validation 2026-10-16: pnpm check green (Vitest 2229 passed, 2 skipped; typecheck, lint, fmt:examples, size, cargo test); pack:check --smoke --skip-npm green (@lumiose/ui packs 86 files, the smoke app builds and passes its browser test); ui-e2e, every component, dev and build: 416 passed, 10 skipped by design; apps/web Playwright: 124 passed plus the UI suite after its fix (run on ports 5294/5296, because another worktree's dev server held 5196). No Rust changes. Screenshots: backlog/assets/task-382-drawer-{bottom,side}-{light,dark}.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Drawer ships in @lumiose/ui as a Dialog (a native modal <dialog>) against the edge its swipeDirection names. It works without JavaScript and returns focus to the trigger. A 1 kB script lets a swipe toward that edge close it, with mouse, pen and touch, past 40% or with a flick, without starting on controls or before scrollable content reaches its end. The close buttons, Escape and the backdrop are the alternatives (WCAG 2.5.7). Base UI's snap points, swipe area, indents, virtual keyboard handling, handles and non-modal drawers are left out (recorded). Docs, the lu-drawer theme, a /ui demo and tests are in.
<!-- SECTION:FINAL_SUMMARY:END -->
