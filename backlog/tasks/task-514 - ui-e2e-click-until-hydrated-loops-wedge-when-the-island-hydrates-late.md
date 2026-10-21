---
id: TASK-514
title: ui-e2e click-until-hydrated loops wedge when the island hydrates late
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 05:44'
updated_date: '2026-10-21 06:01'
labels:
  - test
  - ui
dependencies: []
priority: high
ordinal: 510000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in a local full ui-e2e run in Linux Chromium under load (two suites at once): popover-hover-modal.e2e.ts 'bind:open follows a modal popover and a hover-opened one' (dev) timed out with '<dialog … class="lu-popover"> intercepts pointer events' on 'Open the modal one'. Many island tests wait for hydration by clicking in an expect().toPass() loop with 250 ms checks, from before the island loader held and replayed early clicks (TASK-305). Now a click before hydration is held and replayed after it, so when hydration takes longer than a check: (1) the loop clicks again after the replay opened a modal popover or drawer, or a menu under the pointer, and that click can never land, so the loop wedges until the test timeout; (2) in button.e2e.ts every held click is counted ('saves: 2' instead of 1), and once Save reads 'Saving…' the next click waits for a Save button that is gone. Reproduced with the island module held back 900 ms: the original loops of popover-hover-modal (dev, build), drawer (build) and button (dev, build) fail; the fixed ones pass. Not seen in CI's six runs, but the same timing as TASK-509. Loops whose click sets a fixed value and opens nothing (set-signals, mount) are safe as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Loops that open an overlay click only while it is not open: popover-hover-modal, drawer, context-menu, menubar, navigation-menu (both), preview-card
- [x] #2 button.e2e.ts's hydrated() clicks once and relies on the replay
- [x] #3 With the island module delayed, the fixed loops pass in dev and build; the changed tests pass 5 times in dev and build
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Beacon): reproduced with the island module held back 900 ms. The original loops failed (popover-hover-modal in dev and build, drawer in build, button in dev and build); the guarded overlay loops passed. Guarding the button counter was not enough, since two held clicks replay as 'saves: 2', so button.e2e.ts's hydrated() clicks once (passes 3 times in dev and build with the delay). Checked with CI=1: the changed tests 5 times in dev and build (215 passed, 5 skipped); the full ui-e2e suite in macOS Chromium (1018 passed, 24 skipped) and, at the same time, in Linux Chromium (1017 passed, 24 skipped, 1 failed). That failure is navigation-menu.e2e.ts 'crossing the next trigger keeps it (TASK-451 L25)', which tests the 300 ms travel window with a 12-step mouse move. It fails 1 in 20 only with the browser behind the Docker run-server, whose round trips slow the move; with a local browser it passed 40 of 40 under CPU load. Not a CI cause; left as is.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Click-until-hydrated loops in ui-e2e no longer click past the island's answer. Overlay loops click only while the overlay is closed, and the button helper clicks once and relies on the loader's replay. With a delayed island, the old loops wedge and the new ones pass; the full ui-e2e suite passes in macOS Chromium.
<!-- SECTION:FINAL_SUMMARY:END -->
