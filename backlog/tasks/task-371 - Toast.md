---
id: TASK-371
title: Toast
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 16:54'
updated_date: '2026-10-15 22:26'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
priority: high
ordinal: 372000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Toast manager, viewport, live-region announcements, pause on hover and focus, swipe to dismiss, and actions; works from islands and from form action results.
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

2026-10-15 (Lux, orchestrator): reassigned to Spark, so it runs in parallel with Halo's form controls (TASK-365 to TASK-368). Spark may edit packages/ui/src/<component>/**, the component's docs page and e2e, and add its lines to the shared package files (index.ts, package.json exports, styles.css, themes/default.css, scripts/size.ts, docs README and theming tables).

2026-10-15 (Lux, orchestrator): reassigned to Beacon instead. New sessions cannot start from an automated turn, so the idle Beacon session takes it. The same edit areas apply.

2026-10-15 (Beacon, branch claude/beacon-m12b-ee0e55): implemented.

What is server-rendered and what needs the client (decided; also in packages/ui/docs/toast.md):
- Server HTML: Toast.Viewport (`<lu-toast-viewport role="region" aria-label="Notifications (F6)" tabindex="-1">`) and any Toast.Root a page renders with a plain object, for a form action's result.
  - Toasts show at the window's bottom end (toast.css).
  - Without JS a server toast stays until the next page, and its close button does nothing.
- The element's script (toast.script.ts, 2.30 kB brotli, loaded once per page, no runtime) covers:
  - the top layer: the viewport becomes `popover="manual"` and shows itself, so other popovers' light dismiss leaves it alone (TASK-356 note);
  - following modal dialogs; timers, pause, limit; closing (button, Escape, swipe); F6; focus when a toast goes;
  - the VoiceOver mutation; enter and exit hooks.
- The manager (`createToastManager()`, also `Toast.createToastManager()` as in Base UI) needs an island.
  - Islands share it through a module. Toast objects stay stable, with reactive getters, so `update()` changes a toast in place, without a new element.
  - `close()` sets `transitionStatus: "ending"`, and the part sets `data-ending-style`. The manager removes the toast after its animations, timed through src/animation/animation.ts (no rAF: background pages render no frames).
  - `promise()` turns a loading toast (timeout 0) into success or error.

Design decisions (orchestrator-delegated):
- Roles: each toast is its own live region, `role="status" aria-atomic="true"` (`role="alert"` for priority "high"), as in Zag. Base UI's toasts are non-modal dialogs. The viewport is a named region whose label carries the hotkey (Zag).
- Close protocol: the script fires a cancelable `close` event on the toast. A managed toast prevents it and closes through its manager. Otherwise the script sets `data-ending-style`, waits and removes the toast. Toast.Close is a custom invoker command (`command="--close-toast" commandfor`), with a click fallback where invoker commands are missing.
- Modal dialogs: in Chromium, a manual popover outside an open modal dialog is inert, even re-shown above it (checked). So while a modal dialog is open, the script moves the viewport into the topmost one, behind a comment placeholder, re-shows it, and moves it back when the dialog closes. The e2e uses real input.
- Persistent toasts: the shared dismissal model (src/layer/layer.ts, additive) treats a press inside `lu-toast-viewport` as not outside. A press in a toast leaves an open menu, popover or combobox alone (doc-9 §1; e2e).
- Limit: past `data-limit` (the provider's `limit`, default 3) older toasts get `hidden` + `data-limited`, paused. lu.core has `lu-toast-viewport > [hidden] { display: none !important }`, so a theme's display cannot show them (the theme's `display: grid` did, which the e2e caught).
- Swipe: `data-swipe-directions` (from `swipeDirection`, default down right).
  - Threshold 40px. It locks to one axis after 6px, never starts on a control, decides by the direction at release (so a reversal cancels), and moves at 1/8 speed against an allowed direction.
  - `touch-action` per direction in lu.core, instead of preventDefault on touchmove.
  - While it runs: `data-swiping`, `data-swipe-direction`, `--toast-swipe-movement-x/-y`.
- Named export `createToastManager`: inside a component, `Toast.createToastManager()` makes the compiler warn LUM2001. A member call on an import is read as a reactive value: a false positive, proposed below as a follow-up for Photon. The docs contract test now treats only PascalCase value exports as components.
- Not offered, against Base UI: Positioner and Arrow (anchored toasts); the stacked and expanded layout in the theme (`--toast-index` and `data-expanded` are there for it); `--toast-height`, `--toast-offset-y`, `--toast-frontmost-height`; a configurable hotkey.

doc-9 §16:
- [x] Viewport `role=region`, labelled with the hotkey. Toasts `role=status`/`alert` with `aria-atomic` (Zag's model).
- [x] F6 focuses the viewport. Escape or Shift+Tab from it returns focus, and timers resume when focus leaves.
- [x] Timers pause on hover, focus, window blur and a hidden page, and resume with the remaining time. Toasts over the limit stay hidden and paused.
- [x] Swipe: direction and threshold, axis lock, not on controls, a reversal cancels, touch-action.
- [x] Animate out before removal. When the focused toast closes, focus moves to the next toast's first control, else back to where focus entered the region (F6, Tab or a click).
- [x] §1: modal inertness (relocation); other popovers' light dismiss (manual popover); a toast press does not dismiss layers.
- [x] VoiceOver delay: a word joiner is appended 250ms after a toast appears. The e2e checks the mutation; screen-reader output is not verified here.

WCAG 2.2 AA (doc-9 §17):
- Automated (examples/ui-e2e, dev and build):
  - axe with the WCAG A and AA tags, light and dark, with toasts open (server toasts, island alert with action, promise toast);
  - targets ≥ 24px (the close button is 28px);
  - reflow at 320px with text spacing;
  - keyboard paths (F6, Escape, Tab, Shift+Tab);
  - swipe alternatives.
- Manual:
  - 4.1.3: toasts are live regions and no focus moves (DOM checked; real screen readers not run).
  - 2.2.1: timers pause on hover, focus, blur and hidden. The docs say a toast that times out must hold nothing the reader must act on, and to give actionable toasts `timeout: 0`. The default is 5000ms, as in Base UI.
  - 2.5.1/2.5.7: the close button and Escape stand in for the swipe.
  - 2.4.7: rings on the close button, the theme's buttons, and the viewport (F6).
  - 2.4.11: known limit. A toast that stays (`timeout: 0`) at the bottom corner can cover a focused element under it. It is small and closes with F6 then Escape. Keep such toasts rare.

Public names (proposals, TASK-400):
- Exports `Toast`, `createToastManager`; entries `@lumiose/ui/toast`, `/toast.css`.
- Parts: Provider, Viewport, Root, Content, Title, Description, Action, Close, plus `Toast.createToastManager` and `Toast.useToastManager`.
- Types: ToastManager, ToastObject, ToastOptions, ToastPromiseOptions, Toast{Provider,Viewport,Root,Content,Title,Description,Action,Close}Props.
- Options: id, title, description, type, timeout, priority ("low" | "high"), actionProps, onClose, onRemove; `transitionStatus: "ending"`.
- Provider props: toastManager, timeout, limit. Root props: toast, swipeDirection.
- Element `lu-toast-viewport`; default label "Notifications (F6)"; the F6 hotkey.
- Attributes: data-limit, data-timeout, data-swipe-directions, data-type, data-limited, data-expanded, data-swiping, data-swipe-direction, data-starting-style, data-ending-style.
- Variables: --toast-index, --toast-swipe-movement-x/-y.
- The `close` event; the invoker command `--close-toast`.
- Theme classes `lu-toast-viewport`, `lu-toast`.
- Shared module src/animation/animation.ts (`startFrom`, `afterAnimations`, internal).

Validation 2026-10-16:
- pnpm check, pack:check --smoke --skip-npm, and the ui-e2e suite (338 passed) and the apps/web suites as recorded in TASK-370.
- toast.e2e, dev and build: 27 passed. It covers live regions and the word joiner (in the title, so the toast grid gets no extra row), timers and pauses, the limit, closing by button, Escape and swipe, focus on close, F6, promise toasts, the modal dialog relocation with real input, persistence against a popover, and axe with toasts open in light and dark.
- Screenshots: backlog/assets/task-371-toasts-{light,dark}.png.
- Follow-up: TASK-401 (LUM2001 false positive on Toast.createToastManager() in components).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Toast ships in @lumiose/ui. Server HTML can render toasts (a form action's result), and islands add, update and close them through createToastManager (also Toast.createToastManager). <lu-toast-viewport>'s 2.3 kB script handles both kinds of toast alike:
- it puts them in the top layer as a manual popover, moved into the topmost modal dialog while one is open;
- it times them, pausing on hover, focus, blur and a hidden page, and limits how many show;
- it closes them by button (an invoker command), Escape and swipe, moves focus when one goes, and focuses the region on F6;
- it adds the word joiner that VoiceOver needs.
Toasts are live regions (status, or alert when high priority). A press in one leaves open menus and popovers alone. Docs, theme (lu-toast-viewport, lu-toast), /ui demos and tests are in.
<!-- SECTION:FINAL_SUMMARY:END -->
