---
id: TASK-514
title: ui-e2e click-until-hydrated loops wedge when the island hydrates late
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 05:44'
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
- [ ] #1 Loops that open an overlay click only while it is not open: popover-hover-modal, drawer, context-menu, menubar, navigation-menu (both), preview-card
- [ ] #2 button.e2e.ts's hydrated() clicks once and relies on the replay
- [ ] #3 With the island module delayed, the fixed loops pass in dev and build; the changed tests pass 5 times in dev and build
<!-- AC:END -->
