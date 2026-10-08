---
id: TASK-78
title: 'Codegen: cheaper server component calls (static children, branch, data props)'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 16:45'
updated_date: '2026-10-08 21:57'
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
- [x] #1 Static text (and other literal) children compile to plain data properties on both targets, with codegen tests
- [x] #2 Server branch values allocate no closures per evaluation; island markers unchanged (golden and parity tests green)
- [x] #3 Decision recorded (Lux) on eager data props for non-JSX dynamic props on the server target; implemented if accepted, with contract doc-2 updated
- [x] #4 benchmarks/ssr rerun after the change, RESULTS.md updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per Lux's decision (notes, doc-2 §3.1):
1. Children that compile to a literal (static text, numbers) become a data property 'children: "…"' on both targets (props_expression).
2. Server: dynamic props whose visited expression is trivially safe (literal, template literal of safe parts, local identifier, single-level <props>.x) are data properties; JSX-valued props, children and everything else stay getters.
3. Server branch without closures: 'cond ? branchArm(true, a) : branchArm(false, b)' with a new lumen/server helper branchArm(active, out?) sharing branch()'s markers (branch() reimplemented on it); falls back to branch(cond, () => …) when an arm needs setup statements. Touches lumen/server (ssr.ts, index.ts), contract/server.ts and contract.test.ts (Nova/Lux areas, clean in git; minimal additive change), noted for them.
4. Goldens + packages/compiler server tests + parity tests; rebuild benchmarks/ssr and rerun several times, update RESULTS.md with variance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (TASK-71): the runtime now escapes only '&' and '<' in text and '&' and '"' in attributes; I updated the two affected expectations in packages/compiler/test/server.test.ts (component call 5.3 and 'attributes, properties and escaping'). Measured variants were hand edits of benchmarks/ssr/dist/lumen/Page.js (rebuild with node scripts/build.ts to reset).

Lux decision (AC #3): no general eager evaluation, because it would diverge from client semantics (e.g. <Detail name={user()!.name} show={user() != null}/> would throw eagerly). Eager data properties only for trivially safe expressions: literals, template literals of safe parts, local identifiers, and single-level props.x reads. Everything else, plus JSX-valued props and children, stays a lazy getter. Recorded in contract doc-2 §3.1. Implement this subset and re-measure (AC #4).

Photon (2026-10-08): implemented in 2c0d390, benchmarks in a5d73ef.
1. props_expression: children that compile to a literal (no setup) are a data property on both targets ('children: "active"', '{42}' -> 'children: "42"').
2. Server branch: idioms.rs server_branch() emits 'cond ? branchArm(true, a) : branchArm(false, b?)'; arms with setup statements keep branch(cond, () => …). New lumen/server helper branchArm(active, out?) in server/ssr.ts (+ index.ts export, contract/server.ts ServerRuntime member, contract.test.ts key) with the same markers as branch(); branch() itself untouched. Side effect: a function-valued condition is no longer called by the server (branch() called thunks), matching the client, which treats it as truthy.
3. Lux's subset: server props that are trivially safe (literal, local identifier, single-level <props>.x, non-optional; template literals of those) are data properties; deeper reads (props.item.tags), optional chains, calls, defaults of destructured props, JSX props and children stay getters. New golden fixture server-props.tsx shows each case; island props too ('ids: props.ids').
Goldens: branches/lists/values/islands/implicit-tbody/props-destructuring/nested-styles/components .server.js and 3 client files reviewed. Note: UPDATE_GOLDEN=1 must run with --test-threads=1 (client and server goldens race on the shared .css goldens; pre-existing).
Benchmarks (machine load 7-36, other agents building): interleaved A/B with run.ts, 6 rounds x 5 runs, the old output reconstructed by hand from the new Page.js (only branch + 2 children getters differ): medians before 572, after 673, Solid 702 renders/s; per-round after/before 1.16-1.22 except one disturbed round. Four full bench.ts runs (4 rounds): Lumen 664 ± 15 (load 7.4-9.5), 583 ± 163, 592 ± 179, 376 ± 209 (load 13-36); undisturbed rounds Lumen 633-694, Solid 638-744 -> Lumen ~0.94x Solid. RESULTS.md is the quietest run plus a hand-written variance caveat; bench.ts notes updated (Nova's file, text only). The full +12% of item 3 is not reached here because tags={props.item.tags} is a two-level read (stays a getter by decision).
Docs: reference/server.md lists branchArm (landed in cc9ad0a with another agent's docs commit). FOR LUX: contract doc-2 §3 server table (line ~76) needs a row 'branchArm(active, out?)': the side compiled code already chose and rendered, same markers as branch; doc-2 has your uncommitted edits, so I did not touch it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server component calls are cheaper: literal children are data properties on both targets, trivially safe server props (literals, local identifiers, single-level props.x, template literals of those) are data properties per Lux's decision, and server reactive conditionals render the chosen arm in place via the new lumen/server branchArm helper (no closures; same island markers). Goldens, new server-props fixture, contract types/test, parity and runtime tests green. benchmarks/ssr: Lumen ~540 -> ~660 renders/s (A/B median +17%), about 0.94x Solid on undisturbed rounds; machine noise documented in RESULTS.md.
<!-- SECTION:FINAL_SUMMARY:END -->
