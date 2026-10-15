---
id: TASK-355
title: Dialog and alert dialog
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 17:14'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
priority: high
ordinal: 356000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Dialog.Root (no element; open, onOpenChange, role "dialog" or "alertdialog"), Trigger (button command="show-modal"), Popup (dialog with closedby and labels), Title, Description, Close (command="close", value becomes returnValue). No JavaScript: native dialog and invoker commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dialog and alert dialog work without JavaScript, with the APG keyboard contract and focus return
- [ ] #2 open/onOpenChange and bind:open keep a signal in sync
- [x] #3 Keyboard-contract and axe tests pass
- [x] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [ ] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [ ] #6 The default theme styles Dialog and the docs examples use it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: check Dialog against doc-9 (UI primitives pitfall checklist), sections 1 and 2; give Dialog its rules in the default theme.

2026-10-15 (Halo): claimed (branch claude/halo-m12-945f07); TASK-353's scaffold is committed there.

2026-10-15 (Halo): implemented on branch claude/halo-m12-945f07.

- packages/ui/src/dialog/dialog.tsx: Dialog.Root (no element; open, onOpenChange, role), Trigger (button type=button command=show-modal commandfor aria-haspopup=dialog), Popup (dialog: closedby 'any', or 'closerequest' with role=alertdialog; aria-labelledby/aria-describedby to Title/Description; forwards ref), Title (h2), Description (p), Close (button command=close commandfor; value becomes returnValue). No JavaScript on server pages. The native dialog is the only state: the 'open' prop drives showModal()/close() in an effect, and the dialog's toggle event is the single source of onOpenChange, so a signal written back sees the same value and nothing loops. Caller props are spread first (they override type, aria-haspopup, closedby and the label references) and the wiring last (id, command, commandfor).
- Unstyled per the amended decision-62: no default classes; dialog.css holds one rule in the 'lu' layer, no page scroll behind any modal dialog (:root:has(dialog:modal)), since parts carry no class or attribute of their own. Example styling lives in examples/ui-e2e/src/example.css and the docs page.
- Tests: packages/ui unit tests (9: server HTML wiring, prop overrides, unique ids, parts outside Root; open prop and toggle events in happy-dom, open on mount, ref forwarding). examples/ui-e2e (new Playwright fixture, dev and build, Chromium): no-JS open/Escape/close button/click outside (alert dialog ignores it), APG keyboard contract (Enter and Space open, focus on the first focusable element, Tab and Shift+Tab never reach the page behind, Escape closes, focus returns to the trigger or the opener), a drag from inside to the backdrop does not close, scroll lock, no JavaScript loaded by a server page, island sync both ways (signal opens, trigger/Escape/close report back, returnValue via on:close), a signal that starts true opens on hydration; axe 4.13 with 0 violations closed and with each dialog open. 17 passed, 1 skipped by design (the no-script check runs on the build only).
- Docs: packages/lumiose/docs/ui/dialog.md (anatomy, API, two type-checked examples, styling, keyboard and focus, without JavaScript, browser support), listed in ui/README.md and the docs index; @lumiose/ui linked into the docs examples check (packages/cli/src/docs/examples.test.ts, one line).
- Sizes (pnpm --filter @lumiose/ui size, min/gzip/brotli kB, lumiose runtime excluded): elements JS none; component JS for islands 1.86/0.77/0.68; CSS 0.05/0.07/0.05.
- Screenshots: [light](../assets/task-355-alert-dialog-light.png), [dark](../assets/task-355-alert-dialog-dark.png) (alert dialog open on a server page, fixture's example CSS).

Open:
- AC #2: explicit open/onOpenChange are tested; bind:open waits for TASK-360 (Photon, not on main yet). Next action: once it lands, git merge main and add a bind:open case to examples/ui-e2e (island) and a type test.
- AC #5: the 'UI primitives pitfall checklist' doc is not in backlog/docs yet. My own pass against Base UI and Zag (pending the doc): covered natively or tested: focus on open and its return, inert page behind, Escape closes the topmost of nested dialogs and popovers first (close watchers), alert dialog not light-dismissed, drag-out does not dismiss (tested), scroll lock (tested), ids stable through hydration (no LUM warnings in the island tests), multiple close buttons, form method=dialog. Gaps against Base UI, proposed as follow-ups: non-modal dialogs (Base UI modal=false), defaultOpen, initialFocus/finalFocus (native autofocus covers the first), onOpenChangeComplete after exit animations, nested-dialog state hooks, the Title's heading level (always h2), and the scrollbar's layout shift when the scroll lock hides a classic scrollbar.
- Browser support (needs the user): invoker commands are Baseline 2025 (Chrome/Edge 135, Firefox 144, Safari 26.2), not 'widely available', and there is no fallback, while docs/stability.md promises newer features only with a fallback. Options: accept and document the exception (done in ui/dialog.md for now), or ship a small invoker-commands fallback script with @lumiose/ui (a runtime script for server pages, so it needs TASK-354's mechanism).
<!-- SECTION:NOTES:END -->
