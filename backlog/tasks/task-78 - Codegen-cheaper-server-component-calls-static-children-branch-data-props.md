---
id: TASK-78
title: 'Codegen: cheaper server component calls (static children, branch, data props)'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 16:45'
updated_date: '2026-10-08 21:05'
labels: []
milestone: m-3
dependencies: []
references:
  - benchmarks/ssr/RESULTS.md
priority: medium
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while optimizing the SSR runtime (TASK-71, Nova). After the runtime work, most of the remaining gap to Solid on benchmarks/ssr comes from the server code the compiler emits for component calls. Measured by hand-editing benchmarks/ssr/dist/lumen/Page.js (same runtime, same machine, interleaved runs):

1. Static text children compile to getters: `<Badge kind="ok">active</Badge>` emits `{ kind: "ok", get children() { return "active"; } }`. A plain `children: "active"` (as Solid emits) is safe on both targets (a string literal has no evaluation semantics). Object literals with accessors take V8's slow literal path (no boilerplate clone) and allocate the getter closure per call. Measured: ~545 -> ~595 renders/s (+9%).
2. Server `branch(cond, () => a, () => b)` allocates two closures per evaluation, though the server evaluates one side immediately. A closure-free form (e.g. the runtime receiving the evaluated condition and the rendered side, `ssrBranch(c = !!cond, c ? a : b)`, with markers chosen from c inside islands) gave ~+3%.
3. Server target: getters for non-JSX dynamic props (`tags={props.item.tags}` -> `{ get tags() { return props.item.tags; } }`). There is no reactivity on the server; emitting data properties (`{ tags: props.item.tags }`) evaluates the expression once, in the parent, before the child runs. Measured ~620 -> ~695 renders/s (+12%), which is Solid's level (~700) on the same page. This changes evaluation semantics (eager, once, in the parent's owner/frame, even if the child never reads the prop), so it needs Lux's decision and a contract note (doc-2 says server components get getter props); JSX-valued props and children stay lazy getters, since they must render inside the child's context.

Together 1-3 bring Lumen from ~545 to ~695 renders/s on this page (Solid ~700), versus 338 before TASK-71.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Static text (and other literal) children compile to plain data properties on both targets, with codegen tests
- [ ] #2 Server branch values allocate no closures per evaluation; island markers unchanged (golden and parity tests green)
- [ ] #3 Decision recorded (Lux) on eager data props for non-JSX dynamic props on the server target; implemented if accepted, with contract doc-2 updated
- [ ] #4 benchmarks/ssr rerun after the change, RESULTS.md updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (TASK-71): the runtime now escapes only '&' and '<' in text and '&' and '"' in attributes; I updated the two affected expectations in packages/compiler/test/server.test.ts (component call 5.3 and 'attributes, properties and escaping'). Measured variants were hand edits of benchmarks/ssr/dist/lumen/Page.js (rebuild with node scripts/build.ts to reset).

Lux decision (AC #3): no general eager evaluation, because it would diverge from client semantics (e.g. <Detail name={user()!.name} show={user() != null}/> would throw eagerly). Eager data properties only for trivially safe expressions: literals, template literals of safe parts, local identifiers, and single-level props.x reads. Everything else, plus JSX-valued props and children, stays a lazy getter. Recorded in contract doc-2 §3.1. Implement this subset and re-measure (AC #4).
<!-- SECTION:NOTES:END -->
