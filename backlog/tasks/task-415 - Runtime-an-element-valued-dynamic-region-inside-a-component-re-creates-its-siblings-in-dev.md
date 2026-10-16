---
id: TASK-415
title: >-
  Runtime: an element-valued dynamic region inside a component re-creates its
  siblings in dev
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 02:28'
updated_date: '2026-10-16 04:19'
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
- [x] #1 An element-valued dynamic region returned by a component hydrates onto its own server node in dev as in a build, and updating it leaves its siblings in place
- [x] #2 A runtime test covers it, and the Field.Validity docs drop the 'text inside an element' advice if it no longer applies
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Runtime bug (dev-only hydration), Spark's area.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 9 (no Spark or Photon session is running; it may edit the files the fix needs).

2026-10-16 (Beacon): Cause: the compiler collapsed a fragment with one dynamic item, `<>{props.children(valid())}</>`, into a bare function on the client (`() => …`) and a plain value on the server. In component children (`[label, input, Validity's function, output]`) the siblings after it are created first, so their templates claimed its server nodes (LUM4006 in a build and in dev; in dev the hot wrapper then re-created the instance inside the parent's region on every change, moving the input). Fix (crates/lumiose_compiler children.rs, ssr.rs): a fragment's single dynamic item now compiles like an item of a longer fragment, an `insertValue` range on the client and an `insertValue` block on the server, so it claims when the component is created and re-renders alone. A `children` getter's single item stays a plain value. doc-2 updated (insertValue row and Arrays of renderables). Golden fragment-claim-order changed (a ternary arm `<>{item("a")}</>` is now a range). Test: hydrate.test.ts 'a component that returns a single dynamic item (TASK-415)', hot off and on: no LUM4006, the input, p and output keep their identity, and `valid.set(false)` removes only the old p (fails without the fix). ui-e2e /form/island renders Field.Validity's own <p> among the field's parts, and the async test checks the control stays the same node while typing; field.md drops the 'text inside an element' advice. Checks: cargo test -p lumiose_compiler, clippy, fmt; pnpm test (2386 passed); ui-e2e form.e2e.ts dev and build (41 passed, 1 skipped).
<!-- SECTION:NOTES:END -->
