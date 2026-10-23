---
id: decision-79
title: >-
  The modal scroll lock reserves a scrollbar gutter only where the page
  overflows
date: '2026-10-23 09:22'
status: accepted
---
## Context

`@lumiose/ui/dialog.css` locks the page behind a modal dialog with `:root:has(dialog:modal) { overflow: hidden; scrollbar-gutter: stable }`. The stable gutter keeps a page that had a classic scrollbar (Windows, Linux) from shifting when the scrollbar goes. On a page that fits the window it adds a gutter that was not there: the page narrows by 15 px, and a drawer across the window leaves an empty strip at its inline end (TASK-506 measured 1280 px before, 1265 px with the dialog open, on /drawer of examples/ui-e2e in Linux Chromium).

Dialog's client script already measured the page before a dialog opens and dropped the gutter on a page that fits. Without the script (no JavaScript, or before it loads), plain CSS cannot tell whether the root overflows.

## Decision

Orchestrator direction (Lux, 2026-10-23), from Halo's TASK-507: the scroll lock reserves a scrollbar's gutter only where the page overflows, so had a scrollbar.

- **With the script**, it sets the root's `scrollbar-gutter` inline either way, `stable` where the page overflows and `auto` where it fits, from a measurement taken before the dialog opens. This does not depend on the stylesheet.
- **Without the script**, the stylesheet tells the two apart with a scroll-driven animation: `animation-timeline: scroll(root block)` is active only while the root has scrollable overflow, and its keyframes set `scrollbar-gutter: stable`; the rule itself sets `auto`. This is inside `@supports (animation-timeline: scroll())`.
- **Browsers without scroll timelines** (Firefox) keep `scrollbar-gutter: stable` without the script, as before: a short page there keeps the empty strip until the script runs. The script covers them once it runs.

Checked in Linux Chromium with classic scrollbars shown: a page that fits stays 1280 px wide, a page that overflows stays 1265 px, and a `ResizeObserver` on the root sees no intermediate width, so no frame shifts.

## Consequences

- With classic scrollbars, opening a modal dialog no longer narrows a page that fits the window in Chromium and WebKit, with or without JavaScript, nor in Firefox once the script runs.
- The root carries a CSS animation while a modal dialog is open. A page that sets its own `animation` on the root, or turns animations off with `animation: none !important`, cancels it: without the script, a page that overflows then loses its gutter and shifts by the scrollbar's width. Reduced-motion rules that shorten durations leave it working, since a scroll-driven animation ignores time.
- The Dialog and Drawer docs describe the behaviour with classic scrollbars and the Firefox exception. ui-e2e checks it: a page that fits gets no gutter (with and without JavaScript, the drawer spanning the window) and a page that overflows keeps it.
