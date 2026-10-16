---
id: TASK-415
title: >-
  Runtime: an element-valued dynamic region inside a component re-creates its
  siblings in dev
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 02:28'
updated_date: '2026-10-16 04:06'
labels:
  - runtime
  - bug
milestone: m-12
dependencies: []
priority: medium
ordinal: 414000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-405 (2026-10-16). In `lumiose dev` (not in a build), a component that returns `<>{fn(signal())}</>` where `fn` returns an element (Field.Validity with `{(state) => <p>…</p>}`) and sits among other children of a hydrated island component's children region (inside Field.Root's `<lu-field>`) claims the wrong server nodes: when the signal changes, the reconcile detaches and re-inserts the sibling `<input>` (Field.Control), which fires `change` on the focused input and leaves the old element disconnected. The server HTML has no markers for the element-valued region (`<!--[-->label input p output p<!--]-->`), and dev's `$hot` wrappers (packages/lumiose/src/dom/hot.ts) make every component a region. Repro: examples/ui-e2e /form/island, put `<Field.Validity>{(state) => <p data-testid=login-validity>{String(state.validity.valid)}</p>}</Field.Validity>` inside the Login Field.Root instead of the current `<p><Field.Validity>{(state) => text}</Field.Validity></p>`, then type in Login on the dev project: the input is replaced (a MutationObserver on lu-field shows -[INPUT] +[INPUT]). The build project is fine. Workaround in place: Field.Validity's docs and fixture render text inside an element of the user's.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An element-valued dynamic region returned by a component hydrates onto its own server node in dev as in a build, and updating it leaves its siblings in place
- [ ] #2 A runtime test covers it, and the Field.Validity docs drop the 'text inside an element' advice if it no longer applies
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Runtime bug (dev-only hydration), Spark's area.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 9 (no Spark or Photon session is running; it may edit the files the fix needs).
<!-- SECTION:NOTES:END -->
