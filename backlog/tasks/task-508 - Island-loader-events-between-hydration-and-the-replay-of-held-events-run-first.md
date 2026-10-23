---
id: TASK-508
title: >-
  Island loader: events between hydration and the replay of held events run
  first
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-21 04:57'
updated_date: '2026-10-23 08:52'
labels:
  - runtime
dependencies: []
priority: medium
ordinal: 504000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while diagnosing the toast F6 e2e flake (TASK-509). packages/lumiose/src/dom/islands.ts holds click, input, submit and keydown events that reach an island before it hydrates, and dispatches them again after. It sets 'island.g = 2' (hydrated) right after hydrate() but replays the held events in a setTimeout. An event that arrives in between is not held (the island counts as hydrated) and runs before the events held earlier: a key pressed right after a click that triggered hydration is handled before that click. Reproduced in examples/ui-e2e (build) with the island module delayed 600 ms and 0 ms timers stretched to 400 ms: click 'Add an error' (held), F6 after hydration: F6 finds no toast (the click is not replayed yet) and focus stays on the button. Possible fix: keep holding events while an island's queue is pending (queue them behind it) and mark it hydrated when the replay runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Events that reach an island after hydration but before its held events are replayed are dispatched after them, in order
- [x] #2 A DOM test covers a click held during loading followed by a keydown before the replay
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (0.5.1 batch, worktree branch): claimed and started.

2026-10-23 (Spark): fix in packages/lumiose/src/dom/islands.ts. An island hydrated with caught events stays in the holding state (g = 1) until its replay task runs, which marks it hydrated (g = 2) and dispatches the queue; an island hydrated with no caught events is marked hydrated at once as before. Events that arrive in that window join the queue behind the held ones. Regression test: hydrate.test.ts 'dispatches events that arrive before the replay after the held ones, in order (TASK-508)' (click and key held while loading, F6 dispatched right after the loader's hydration callback, before the replay task): fails on the old loader with ['F6:0', 'click', 'a:1'], passes with the fix. Browser check (scratch spec, not committed): ui-e2e /toast/island with the island module held back until after the click and 0 ms timers stretched to 400 ms, F6 100 ms after the module arrived: old loader 5 of 6 fail with 'Received: inactive' (the CI symptom), fixed loader 6 of 6 pass (dev, build); click and F6 both held before hydration: 6 of 6 pass. The TASK-509 wait in toast.e2e.ts is no longer needed: removed it, with a comment pointing here; toast.e2e.ts 5 repeats in dev and build: 225 passed, 5 skipped. Docs: concepts/islands.md and reference/dom.md state the order.
<!-- SECTION:NOTES:END -->
