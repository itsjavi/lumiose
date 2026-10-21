---
id: TASK-508
title: >-
  Island loader: events between hydration and the replay of held events run
  first
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-21 04:57'
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
- [ ] #1 Events that reach an island after hydration but before its held events are replayed are dispatched after them, in order
- [ ] #2 A DOM test covers a click held during loading followed by a keydown before the replay
<!-- AC:END -->
